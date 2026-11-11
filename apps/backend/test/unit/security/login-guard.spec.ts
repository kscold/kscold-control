import { HttpStatus, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { LoginUseCase } from '@/auth/application/use-cases/login.use-case';
import { LOGIN_THROTTLED_MESSAGE } from '@/security/application/services/login-guard.service';
import {
  decideLoginBlock,
  type LoginAttemptRecord,
  type LoginSubject,
} from '@/security/domain/login-guard/login-block.policy';
import { sessionHarness } from '../auth/auth-session.fake';
import { loginGuardHarness } from './login-guard.fake';

const MINUTE = 60_000;
const T0 = new Date('2026-11-11T03:00:00.000Z').getTime();
const at = (minutes: number) => new Date(T0 + minutes * MINUTE);

const attacker: LoginSubject = {
  ip: '203.0.113.7',
  account: 'admin@example.com',
  origin: 'external',
};

function failures(
  minutes: number[],
  overrides: Partial<LoginAttemptRecord> = {},
): LoginAttemptRecord[] {
  return minutes.map((m) => ({
    ...attacker,
    result: 'failure',
    at: at(m),
    ...overrides,
  }));
}

describe('decideLoginBlock', () => {
  it('같은 IP 가 15분 안에 5번 틀리면 마지막 실패부터 1시간 막는다', () => {
    const history = failures([0, 1, 2, 3, 14.99]);

    expect(decideLoginBlock(attacker, history, at(15)).ipBanUntil).toEqual(
      at(74.99),
    );
    expect(
      decideLoginBlock(attacker, history.slice(0, 4), at(15)).ipBanUntil,
    ).toBeNull();
  });

  it('5번이 꼭 15분에 걸쳐 있으면 막지 않는다', () => {
    const history = failures([0, 1, 2, 3, 15]);

    expect(decideLoginBlock(attacker, history, at(15)).ipBanUntil).toBeNull();
  });

  it('차단은 마지막 실패 1시간 뒤에 풀린다', () => {
    const history = failures([0, 1, 2, 3, 4]);

    expect(decideLoginBlock(attacker, history, at(63.99)).ipBanUntil).toEqual(
      at(64),
    );
    expect(decideLoginBlock(attacker, history, at(64)).ipBanUntil).toBeNull();
  });

  it('IP 규칙은 거절된 시도도 세고 성공은 세지 않는다', () => {
    const refused = failures([0, 1, 2, 3, 4], { result: 'refused' });
    const succeeded = failures([0, 1, 2, 3, 4], { result: 'success' });

    expect(
      decideLoginBlock(attacker, refused, at(5)).ipBanUntil,
    ).not.toBeNull();
    expect(decideLoginBlock(attacker, succeeded, at(5)).ipBanUntil).toBeNull();
  });

  it('하루 20번째 실패에서 방화벽에 올리고 24시간이 지난 실패는 세지 않는다', () => {
    const spread = Array.from({ length: 20 }, (_, i) => i * 72);
    const now = at(19 * 72);

    expect(
      decideLoginBlock(attacker, failures(spread.slice(0, 19)), now).firewall,
    ).toBe(false);
    expect(decideLoginBlock(attacker, failures(spread), now).firewall).toBe(
      true,
    );
    expect(
      decideLoginBlock(attacker, failures(spread), at(24 * 60)).firewall,
    ).toBe(false);
  });

  it('한 계정이 여러 IP 에서 15분 안에 10번 틀리면 그 계정만 15분 잠근다', () => {
    const spread = Array.from({ length: 10 }, (_, i) =>
      failures([i], { ip: `198.51.100.${i + 1}` }),
    ).flat();
    const fresh = { ...attacker, ip: '192.0.2.50' };

    const decision = decideLoginBlock(fresh, spread, at(10));
    expect(decision.accountLockedUntil).toEqual(at(24));
    expect(decision.ipBanUntil).toBeNull();
    expect(
      decideLoginBlock(fresh, spread.slice(0, 9), at(10)).accountLockedUntil,
    ).toBeNull();
    expect(
      decideLoginBlock(
        { ...fresh, account: 'other@example.com' },
        spread,
        at(10),
      ).accountLockedUntil,
    ).toBeNull();
    expect(
      decideLoginBlock(fresh, spread, at(24)).accountLockedUntil,
    ).toBeNull();
  });

  it('계정 규칙은 거절된 시도와 허용 목록 주소의 실패를 세지 않는다', () => {
    const refused = failures([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], {
      result: 'refused',
    });
    const vouched = failures([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], {
      origin: 'vouched',
    });

    expect(
      decideLoginBlock(attacker, refused, at(10)).accountLockedUntil,
    ).toBeNull();
    expect(
      decideLoginBlock(attacker, vouched, at(10)).accountLockedUntil,
    ).toBeNull();
  });

  it('허용 목록 주소는 아무리 틀려도 막지 않는다', () => {
    const vouched = { ...attacker, origin: 'vouched' as const };
    const history = failures(
      Array.from({ length: 30 }, (_, i) => i / 2),
      { origin: 'vouched' },
    );

    expect(decideLoginBlock(vouched, history, at(15))).toEqual({
      ipBanUntil: null,
      firewall: false,
      accountLockedUntil: null,
    });
  });

  it('내부 주소는 IP 로 막지 않지만 계정 규칙은 건다', () => {
    const internal = {
      ...attacker,
      ip: '127.0.0.1',
      origin: 'internal' as const,
    };
    const history = failures(
      Array.from({ length: 30 }, (_, i) => i / 2),
      { ip: '127.0.0.1', origin: 'internal' },
    );

    const decision = decideLoginBlock(internal, history, at(15));
    expect(decision.ipBanUntil).toBeNull();
    expect(decision.firewall).toBe(false);
    expect(decision.accountLockedUntil).not.toBeNull();
  });
});

describe('LoginUseCase with LoginGuardService', () => {
  const PASSWORD = 'correct horse';
  let passwordHash: string;
  let harness: Awaited<ReturnType<typeof loginGuardHarness>>;
  let useCase: LoginUseCase;
  let previousAllowlist: string | undefined;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(PASSWORD, 4);
  });

  beforeEach(async () => {
    previousAllowlist = process.env.SECURITY_ALLOWLIST;
    delete process.env.SECURITY_ALLOWLIST;
    jest.useFakeTimers({
      now: T0,
      doNotFake: [
        'nextTick',
        'setImmediate',
        'setTimeout',
        'setInterval',
        'queueMicrotask',
      ],
    });
    const admin = {
      id: 'user-1',
      email: 'admin@example.com',
      password: passwordHash,
      roles: [{ name: 'admin', permissions: [] }],
    };
    const users = {
      findByEmail: async (email: string) =>
        email === admin.email ? admin : null,
      findByIdWithRoles: async (id: string) => (id === admin.id ? admin : null),
    };
    harness = await loginGuardHarness();
    useCase = new LoginUseCase(
      users as never,
      sessionHarness().sessions,
      harness.guard,
    );
  });

  afterEach(async () => {
    jest.useRealTimers();
    await harness.cleanup();
    if (previousAllowlist === undefined) delete process.env.SECURITY_ALLOWLIST;
    else process.env.SECURITY_ALLOWLIST = previousAllowlist;
  });

  const login = (ip: string, password: string, email = 'admin@example.com') =>
    useCase.execute({ email, password }, { ip, userAgent: null }).then(
      () => 200,
      (error: { getStatus?: () => number }) => error.getStatus?.() ?? 500,
    );

  const statuses = async (ip: string, count: number, email?: string) => {
    const seen: number[] = [];
    for (let i = 0; i < count; i++) seen.push(await login(ip, 'wrong', email));
    return seen;
  };

  it('5번 틀린 IP 는 6번째에 429 를 받고 맞는 비밀번호도 막히다가 1시간 뒤 풀린다', async () => {
    const ip = '203.0.113.10';

    expect(await statuses(ip, 6)).toEqual([401, 401, 401, 401, 401, 429]);
    expect(await login(ip, PASSWORD)).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(harness.ipBans.rows.get(ip)).toMatchObject({
      source: 'auto-login',
      active: true,
    });
    expect(harness.nginx.applied[harness.nginx.applied.length - 1]).toContain(
      ip,
    );

    jest.setSystemTime(T0 + 61 * MINUTE);
    expect(await login(ip, PASSWORD)).toBe(200);
  });

  it('429 문구는 잠시 뒤 다시 시도하라고 안내한다', async () => {
    const ip = '203.0.113.11';
    await statuses(ip, 5);

    await expect(
      useCase.execute(
        { email: 'admin@example.com', password: PASSWORD },
        { ip, userAgent: null },
      ),
    ).rejects.toMatchObject({ message: LOGIN_THROTTLED_MESSAGE });
    expect(LOGIN_THROTTLED_MESSAGE).toContain('잠시 뒤 다시 시도');
  });

  it('하루 20번 실패한 IP 는 호스트 방화벽 차단 목록에 한 번 올라간다', async () => {
    const ip = '203.0.113.12';
    for (let round = 0; round < 4; round++) {
      jest.setSystemTime(T0 + round * 2 * 60 * MINUTE);
      await statuses(ip, 5);
    }
    await statuses(ip, 3);

    const entries = await harness.firewallEntries();
    expect(entries.filter(([blocked]) => blocked === ip)).toEqual([
      [ip, expect.any(String), 'Control 로그인 실패 20회'],
    ]);
    expect(
      harness.audits.filter((a) => a.action === 'login.firewall-block'),
    ).toHaveLength(1);
  });

  it.each([
    ['허용 목록에 적은 주소', '198.51.100.20', '198.51.100.20'],
    ['허용 목록 대역 안의 주소', '198.51.100.21', '198.51.100.0/24'],
  ])('%s 는 20번 틀려도 막히지 않는다', async (_label, ip, allowlist) => {
    process.env.SECURITY_ALLOWLIST = allowlist;

    expect(new Set(await statuses(ip, 20))).toEqual(new Set([401]));
    expect(await login(ip, PASSWORD)).toBe(200);
    expect(harness.ipBans.rows.has(ip)).toBe(false);
    expect((await harness.firewallEntries()).map(([b]) => b)).not.toContain(ip);
  });

  it('SSH 내 IP 목록의 주소는 20번 틀려도 막히지 않는다', async () => {
    const ip = '192.0.2.30';
    await harness.addKnownIp(ip);

    expect(new Set(await statuses(ip, 20))).toEqual(new Set([401]));
    expect(await login(ip, PASSWORD)).toBe(200);
    expect(harness.ipBans.rows.has(ip)).toBe(false);
  });

  it('내부 주소는 IP 로 막지 않지만 계정 잠금은 받는다', async () => {
    const email = 'ops@example.com';

    for (const ip of ['10.0.0.5', '100.64.0.9', '172.16.0.9']) {
      expect(await statuses(ip, 3, email)).toEqual([401, 401, 401]);
    }
    expect(await statuses('127.0.0.1', 2, email)).toEqual([401, 429]);
    expect(harness.ipBans.rows.size).toBe(0);
  });

  it('프록시 주소(루프백)는 허용 목록에 있어도 계정 규칙을 받는다', async () => {
    process.env.SECURITY_ALLOWLIST = '127.0.0.1,::1';
    const email = 'proxy@example.com';

    expect(await statuses('127.0.0.1', 11, email)).toEqual([
      ...Array(10).fill(401),
      429,
    ]);
  });

  it('여러 IP 에서 한 계정을 10번 틀리면 그 계정만 15분 늦춘다', async () => {
    const email = 'admin@example.com';
    for (let i = 1; i <= 5; i++) {
      expect(await statuses(`198.51.100.${100 + i}`, 2, email)).toEqual([
        401, 401,
      ]);
    }

    expect(await login('192.0.2.60', PASSWORD)).toBe(429);
    expect(await login('192.0.2.60', 'wrong', 'someone@example.com')).toBe(401);

    jest.setSystemTime(T0 + 16 * MINUTE);
    expect(await login('192.0.2.60', PASSWORD)).toBe(200);
  });

  it('성공과 실패를 IP 와 계정과 함께 남긴다', async () => {
    await login('192.0.2.70', 'wrong');
    await login('192.0.2.70', PASSWORD);
    await login('192.0.2.70', 'wrong', 'ghost@example.com');

    const recorded = harness.attempts.rows
      .filter((row) => row.ip === '192.0.2.70')
      .map(({ account, result, reason }) => ({ account, result, reason }));
    expect(recorded).toEqual([
      {
        account: 'admin@example.com',
        result: 'failure',
        reason: 'wrong-password',
      },
      { account: 'admin@example.com', result: 'success', reason: null },
      {
        account: 'ghost@example.com',
        result: 'failure',
        reason: 'unknown-account',
      },
    ]);
    const audited = harness.audits.filter(
      (a) => (a.metadata as { ip?: string } | undefined)?.ip === '192.0.2.70',
    );
    expect(audited.map((a) => a.action)).toEqual([
      'login.failure',
      'login.success',
      'login.failure',
    ]);
    expect(audited[0].summary).toContain('192.0.2.70');
    expect(audited[0].targetId).toBe('admin@example.com');
    expect(audited[1].actorId).toBe('user-1');
  });

  it('대소문자만 바꾼 이메일도 같은 계정으로 센다', async () => {
    for (let i = 1; i <= 10; i++) {
      const email = i % 2 ? 'Admin@Example.com' : ' admin@example.com';
      await login(`198.51.100.${150 + i}`, 'wrong', email);
    }

    expect(await login('192.0.2.80', PASSWORD)).toBe(429);
  });

  it('없는 계정과 틀린 비밀번호는 같은 오류를 낸다', async () => {
    const unknown = useCase.execute(
      { email: 'nobody@example.com', password: 'wrong' },
      { ip: '192.0.2.90', userAgent: null },
    );
    const wrong = useCase.execute(
      { email: 'admin@example.com', password: 'wrong' },
      { ip: '192.0.2.91', userAgent: null },
    );

    const [a, b] = await Promise.allSettled([unknown, wrong]);
    expect(a.status).toBe('rejected');
    expect(b.status).toBe('rejected');
    const [ea, eb] = [a, b].map(
      (r) => (r as PromiseRejectedResult).reason as UnauthorizedException,
    );
    expect(ea).toBeInstanceOf(UnauthorizedException);
    expect(ea.getResponse()).toEqual(eb.getResponse());
  });

  it('오래된 로그인 기록은 30일 뒤 지운다', async () => {
    await login('192.0.2.95', 'wrong');
    await login('192.0.2.95', PASSWORD);
    jest.setSystemTime(T0 + 31 * 24 * 60 * MINUTE);
    await login('192.0.2.95', PASSWORD);

    await harness.guard.prune();

    expect(harness.attempts.rows.map((row) => row.at)).toEqual([
      new Date(T0 + 31 * 24 * 60 * MINUTE),
    ]);
  });
});
