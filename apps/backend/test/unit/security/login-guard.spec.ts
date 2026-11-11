import { HttpStatus, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { LoginUseCase } from '@/auth/application/use-cases/login.use-case';
import { LOGIN_THROTTLED_MESSAGE } from '@/security/application/services/login-guard.service';
import {
  clientAddress,
  parseTrustedProxies,
  type ClientAddress,
  type ProxyTrust,
} from '@/common/utils/client-ip.util';
import {
  decideLoginBlock,
  loginIpGroup,
  normalizeLoginAccount,
  type LoginAttemptRecord,
  type LoginSubject,
} from '@/security/domain/login-guard/login-block.policy';
import { mfaHarness } from '../auth/mfa.fake';
import { loginGuardHarness } from './login-guard.fake';

const MINUTE = 60_000;
const T0 = new Date('2026-11-11T03:00:00.000Z').getTime();
const at = (minutes: number) => new Date(T0 + minutes * MINUTE);

const attacker: LoginSubject = {
  ip: '203.0.113.7',
  ipGroup: '203.0.113.7',
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
    reason: 'wrong-password',
    at: at(m),
    ...overrides,
  }));
}

const range = (count: number, step = 1) =>
  Array.from({ length: count }, (_, i) => i * step);

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

  it('IP 규칙은 차단돼 돌려보낸 시도는 세고, 계정 잠금으로 돌려보낸 시도와 성공은 세지 않는다', () => {
    const minutes = [0, 1, 2, 3, 4];
    const ipBanned = failures(minutes, {
      result: 'refused',
      reason: 'ip-banned',
    });
    const accountLocked = failures(minutes, {
      result: 'refused',
      reason: 'account-locked',
    });
    const succeeded = failures(minutes, { result: 'success', reason: null });

    expect(
      decideLoginBlock(attacker, ipBanned, at(5)).ipBanUntil,
    ).not.toBeNull();
    expect(
      decideLoginBlock(attacker, accountLocked, at(5)).ipBanUntil,
    ).toBeNull();
    expect(decideLoginBlock(attacker, succeeded, at(5)).ipBanUntil).toBeNull();
  });

  it('계정 잠금으로 돌려보낸 시도도 15분에 60번 몰리면 IP 를 막는다', () => {
    const locked = {
      result: 'refused' as const,
      reason: 'account-locked' as const,
    };

    expect(
      decideLoginBlock(attacker, failures(range(59, 0.25), locked), at(15))
        .ipBanUntil,
    ).toBeNull();
    expect(
      decideLoginBlock(attacker, failures(range(60, 0.25), locked), at(15))
        .ipBanUntil,
    ).toEqual(at(14.75 + 60));
  });

  it('하루 20번째 실패에서 방화벽에 올리고 24시간이 지난 실패는 세지 않는다', () => {
    const spread = range(20, 72);
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
    const spread = range(10).flatMap((i) =>
      failures([i], {
        ip: `198.51.100.${i + 1}`,
        ipGroup: `198.51.100.${i + 1}`,
      }),
    );
    const fresh = { ...attacker, ip: '192.0.2.50', ipGroup: '192.0.2.50' };

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

  it('바깥에서 쌓인 실패는 내부망·허용 목록·확인 못 한 주소의 로그인을 잠그지 않는다', () => {
    const external = failures(range(30, 0.4));

    for (const origin of [
      'internal',
      'local',
      'vouched',
      'unverified',
    ] as const) {
      expect(
        decideLoginBlock({ ...attacker, origin }, external, at(12))
          .accountLockedUntil,
      ).toBeNull();
    }
    expect(
      decideLoginBlock(attacker, external, at(12)).accountLockedUntil,
    ).not.toBeNull();
  });

  it('허용 목록 주소는 IP 로 막지 않고, 같은 출처에서 30번 틀리면 계정을 잠근다', () => {
    const vouched = { ...attacker, origin: 'vouched' as const };
    const history = (count: number) =>
      failures(range(count, 0.4), { origin: 'vouched' });

    const below = decideLoginBlock(vouched, history(29), at(12));
    expect(below).toEqual({
      ipBanUntil: null,
      firewall: false,
      accountLockedUntil: null,
    });
    expect(
      decideLoginBlock(vouched, history(30), at(12)).accountLockedUntil,
    ).not.toBeNull();
  });

  it('내부 주소와 확인 못 한 주소는 IP 로 막지 않지만 계정 규칙은 건다', () => {
    for (const origin of ['internal', 'local', 'unverified'] as const) {
      const subject = { ...attacker, origin };
      const history = failures(range(30, 0.5), { origin });

      const decision = decideLoginBlock(subject, history, at(15));
      expect(decision.ipBanUntil).toBeNull();
      expect(decision.firewall).toBe(false);
      expect(decision.accountLockedUntil).not.toBeNull();
    }
  });

  it('IPv6 는 같은 /64 대역의 다른 주소 실패를 함께 센다', () => {
    const subject = {
      ...attacker,
      ip: '2001:db8:1:2::99',
      ipGroup: loginIpGroup('2001:db8:1:2::99'),
    };
    const rotated = range(5).flatMap((i) =>
      failures([i], {
        ip: `2001:db8:1:2::${i + 1}`,
        ipGroup: loginIpGroup(`2001:db8:1:2::${i + 1}`),
      }),
    );

    expect(decideLoginBlock(subject, rotated, at(5)).ipBanUntil).not.toBeNull();
    expect(
      decideLoginBlock(
        {
          ...subject,
          ip: '2001:db8:1:3::1',
          ipGroup: loginIpGroup('2001:db8:1:3::1'),
        },
        rotated,
        at(5),
      ).ipBanUntil,
    ).toBeNull();
  });
});

describe('loginIpGroup', () => {
  it('IPv4 는 주소 하나, IPv6 는 같은 표기의 /64 대역으로 묶는다', () => {
    expect(loginIpGroup('203.0.113.7')).toBe('203.0.113.7');
    expect(loginIpGroup('2001:DB8:1:2:abcd::1')).toBe('2001:db8:1:2::/64');
    expect(loginIpGroup('2001:0db8:0001:0002:ffff:ffff:ffff:ffff')).toBe(
      '2001:db8:1:2::/64',
    );
    expect(loginIpGroup('2001:db8:0:0:1::1')).toBe('2001:db8::/64');
    expect(loginIpGroup('2001:db8:1:2::192.0.2.4')).toBe('2001:db8:1:2::/64');
    expect(loginIpGroup(null)).toBeNull();
  });
});

describe('normalizeLoginAccount', () => {
  it('제어 문자와 글자 방향 문자를 지우고 소문자로 맞춘다', () => {
    expect(normalizeLoginAccount(' Admin@Example.com‮\u0000⁦\u009f ')).toBe(
      'admin@example.com',
    );
    expect(normalizeLoginAccount('ad‭min@example.com\n')).toBe(
      'admin@example.com',
    );
  });

  it('폭 없는 문자와 BOM 을 지운다', () => {
    expect(
      normalizeLoginAccount('\ufeffad\u200bmi\u200cn@exa\u200dmple.com'),
    ).toBe('admin@example.com');
  });
});

describe('LoginUseCase with LoginGuardService', () => {
  // 없는 계정은 운영과 같은 비용(cost 10)으로 비교하므로 테스트를 함께 돌리는 부하에서는 오래 걸린다.
  jest.setTimeout(30_000);
  const PASSWORD = 'correct horse';
  let passwordHash: string;
  let harness: Awaited<ReturnType<typeof loginGuardHarness>>;
  let useCase: LoginUseCase;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(PASSWORD, 4);
  });

  async function build(options: { allowlist?: string } = {}) {
    await harness?.cleanup();
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
    const built = await mfaHarness(options);
    harness = built.loginGuard;
    useCase = new LoginUseCase(
      users as never,
      built.sessions,
      harness.guard,
      built.mfa,
    );
  }

  beforeEach(async () => {
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
    await build();
  });

  afterEach(async () => {
    jest.useRealTimers();
    await harness.cleanup();
  });

  const login = (
    ip: string,
    password: string,
    email = 'admin@example.com',
    ipVerified = true,
  ) =>
    useCase
      .execute({ email, password }, { ip, ipVerified, userAgent: null })
      .then(
        () => 200,
        (error: { getStatus?: () => number }) => error.getStatus?.() ?? 500,
      );

  const statuses = async (
    ip: string,
    count: number,
    email?: string,
    ipVerified?: boolean,
  ) => {
    const seen: number[] = [];
    for (let i = 0; i < count; i++) {
      seen.push(await login(ip, 'wrong', email, ipVerified));
    }
    return seen;
  };

  const tally = (seen: number[]) =>
    seen.reduce<Record<number, number>>(
      (counts, status) => ({ ...counts, [status]: (counts[status] ?? 0) + 1 }),
      {},
    );

  const lockAdminFromOutside = async () => {
    for (let i = 1; i <= 10; i++) {
      expect(await login(`198.51.100.${i}`, 'wrong')).toBe(401);
    }
  };

  const firewalled = async () =>
    (await harness.firewallEntries()).map(([blocked]) => blocked);

  it('5번 틀린 IP 는 6번째에 429 를 받고 맞는 비밀번호도 막히다가 1시간 뒤 풀린다', async () => {
    const ip = '203.0.113.10';

    expect(await statuses(ip, 6)).toEqual([401, 401, 401, 401, 401, 429]);
    expect(await login(ip, PASSWORD)).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(harness.ipBans.rows.get(ip)).toMatchObject({
      source: 'auto-login',
      active: true,
    });

    jest.setSystemTime(T0 + 61 * MINUTE);
    expect(await login(ip, PASSWORD)).toBe(200);
  });

  it('429 문구는 잠시 뒤 다시 시도하라고 안내한다', async () => {
    const ip = '203.0.113.11';
    await statuses(ip, 5);

    await expect(
      useCase.execute(
        { email: 'admin@example.com', password: PASSWORD },
        { ip, ipVerified: true, userAgent: null },
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

  describe('동시에 몰린 시도', () => {
    it('한 IP 가 50번을 한꺼번에 보내도 비밀번호 확인까지 가는 것은 5번뿐이다', async () => {
      const ip = '203.0.113.20';

      const seen = await Promise.all(range(50).map(() => login(ip, 'wrong')));

      expect(tally(seen)).toEqual({ 401: 5, 429: 45 });
      expect(harness.ipBans.rows.get(ip)?.active).toBe(true);
    });

    it('여러 IP 가 한 계정에 한꺼번에 보내도 비밀번호 확인까지 가는 것은 10번뿐이다', async () => {
      const seen = await Promise.all(
        range(50).map((i) => login(`198.51.100.${i + 1}`, 'wrong')),
      );

      expect(tally(seen)).toEqual({ 401: 10, 429: 40 });
    });

    it('네 번 틀린 뒤 맞는 비밀번호를 두 번 눌러도 IP 가 막히지 않는다', async () => {
      const ip = '203.0.113.22';
      expect(await statuses(ip, 4)).toEqual([401, 401, 401, 401]);

      const doubleSubmit = await Promise.all([
        login(ip, PASSWORD),
        login(ip, PASSWORD),
      ]);

      expect(doubleSubmit.sort()).toEqual([200, 429]);
      expect(harness.ipBans.rows.has(ip)).toBe(false);
      expect(await login(ip, PASSWORD)).toBe(200);
      expect(await statuses(ip, 1)).toEqual([401]);
    });

    it('한도 아래로 함께 들어온 맞는 로그인은 모두 통과하고, 끝난 시도는 더 세지 않는다', async () => {
      const ip = '203.0.113.21';

      expect(
        await Promise.all(range(4).map(() => login(ip, PASSWORD))),
      ).toEqual([200, 200, 200, 200]);
      expect(await statuses(ip, 5)).toEqual([401, 401, 401, 401, 401]);
    });
  });

  describe('공격으로 계정이 잠겼을 때 운영자', () => {
    it('바깥 IP 에서 여러 번 다시 시도해도 그 IP 는 막히지 않고, 잠금이 풀리면 들어간다', async () => {
      const operator = '203.0.113.50';
      await lockAdminFromOutside();

      for (let retry = 0; retry < 8; retry++) {
        expect(await login(operator, PASSWORD)).toBe(429);
      }
      expect(harness.ipBans.rows.has(operator)).toBe(false);
      expect(await firewalled()).not.toContain(operator);

      jest.setSystemTime(T0 + 16 * MINUTE);
      expect(await login(operator, PASSWORD)).toBe(200);
    });

    it('잠긴 계정을 기계처럼 60번 두드리는 IP 는 막는다', async () => {
      const hammer = '203.0.113.51';
      await lockAdminFromOutside();

      await statuses(hammer, 59);
      expect(harness.ipBans.rows.has(hammer)).toBe(false);
      await statuses(hammer, 1);
      expect(harness.ipBans.rows.get(hammer)?.active).toBe(true);
    });

    it('내부망·허용 목록 주소·SSH 내 IP 에서는 바로 로그인한다', async () => {
      await build({ allowlist: '192.0.2.0/24' });
      await harness.addKnownIp('198.51.100.200');
      await lockAdminFromOutside();
      expect(await login('203.0.113.52', PASSWORD)).toBe(429);

      expect(await login('10.0.0.5', PASSWORD)).toBe(200);
      expect(await login('100.64.0.9', PASSWORD)).toBe(200);
      expect(await login('192.0.2.30', PASSWORD)).toBe(200);
      expect(await login('198.51.100.200', PASSWORD)).toBe(200);
    });
  });

  describe('프록시 비밀값으로 확인하지 못한 주소', () => {
    it('꾸민 외부 IP 는 아무리 틀려도 nginx·방화벽 차단에 오르지 않고 계정 잠금만 받는다', async () => {
      const forged = '203.0.113.99';

      expect(tally(await statuses(forged, 25, undefined, false))).toEqual({
        401: 10,
        429: 15,
      });
      expect(harness.ipBans.rows.size).toBe(0);
      expect(await firewalled()).toEqual([]);
      expect(await login(forged, PASSWORD, undefined, true)).toBe(200);
    });

    it('비밀값 없이 들어온 바깥 실패도 내부망 로그인을 잠그지 않는다', async () => {
      for (let i = 1; i <= 10; i++) {
        expect(await login(`198.51.100.${i}`, 'wrong', undefined, false)).toBe(
          401,
        );
      }

      expect(await login('203.0.113.98', PASSWORD, undefined, false)).toBe(429);
      expect(await login('10.0.0.5', PASSWORD, undefined, false)).toBe(200);
      expect(await login('100.64.0.9', PASSWORD, undefined, false)).toBe(200);
    });

    it('허용 목록 주소를 사칭해도 예외를 받지 못한다', async () => {
      await build({ allowlist: '198.51.100.20' });

      expect(await statuses('198.51.100.20', 11, undefined, false)).toEqual([
        ...Array(10).fill(401),
        429,
      ]);
    });
  });

  describe('같은 컴퓨터의 프로세스·컨테이너가 보낸 시도', () => {
    const SECRET = 'proxy-secret-for-tests-0123456789abcdef';
    const withSecret: ProxyTrust = {
      proxies: parseTrustedProxies(undefined),
      secret: SECRET,
    };
    const withoutSecret: ProxyTrust = { ...withSecret, secret: null };
    const request = (
      trust: ProxyTrust,
      peer: string,
      headers: Record<string, string> = {},
    ) => clientAddress({ headers, socket: { remoteAddress: peer } }, trust);
    const loginAs = (address: ClientAddress, password: string) =>
      useCase
        .execute(
          { email: 'admin@example.com', password },
          { ip: address.ip, ipVerified: address.verified, userAgent: null },
        )
        .then(
          () => 200,
          (error: { getStatus?: () => number }) => error.getStatus?.() ?? 500,
        );

    it('비밀값이 있으면 비밀값 없이·틀린 비밀값으로·직접 들어온 실패가 확인된 내부망 로그인을 잠그지 못한다', async () => {
      const lan = request(withSecret, '127.0.0.1', {
        'x-control-proxy-secret': SECRET,
        'x-real-ip': '10.0.0.5',
      });
      const tailscale = request(withSecret, '127.0.0.1', {
        'x-control-proxy-secret': SECRET,
        'x-real-ip': '100.64.0.9',
      });
      const local = [
        request(withSecret, '127.0.0.1', { 'x-real-ip': '10.0.0.5' }),
        request(withSecret, '127.0.0.1', {
          'x-control-proxy-secret': 'x'.repeat(SECRET.length),
          'x-real-ip': '10.0.0.5',
        }),
        request(withSecret, '172.17.0.2'),
      ];
      expect(lan).toEqual({ ip: '10.0.0.5', verified: true });

      for (let i = 0; i < 10; i++) {
        expect(await loginAs(local[i % 3], 'wrong')).toBe(401);
      }

      expect(await loginAs(local[0], PASSWORD)).toBe(429);
      expect(await loginAs(lan, PASSWORD)).toBe(200);
      expect(await loginAs(tailscale, PASSWORD)).toBe(200);
      expect(harness.ipBans.rows.size).toBe(0);
    });

    it('비밀값이 있으면 확인된 프록시 자신의 주소도 내부망과 따로 센다', async () => {
      const proxySelf = request(withSecret, '127.0.0.1', {
        'x-control-proxy-secret': SECRET,
        'x-real-ip': '127.0.0.1',
      });
      const lan = request(withSecret, '127.0.0.1', {
        'x-control-proxy-secret': SECRET,
        'x-real-ip': '192.168.1.9',
      });

      for (let i = 0; i < 10; i++) {
        expect(await loginAs(proxySelf, 'wrong')).toBe(401);
      }

      expect(await loginAs(proxySelf, PASSWORD)).toBe(429);
      expect(await loginAs(lan, PASSWORD)).toBe(200);
    });

    it('비밀값이 없으면 바깥 실패와 로컬 실패가 서로를 잠그지 않는다', async () => {
      const outside = (n: number) =>
        request(withoutSecret, '127.0.0.1', { 'x-real-ip': `198.51.100.${n}` });
      const lan = request(withoutSecret, '127.0.0.1', {
        'x-real-ip': '10.0.0.5',
      });
      const localProcess = request(withoutSecret, '127.0.0.1');

      for (let i = 1; i <= 10; i++) {
        expect(await loginAs(outside(i), 'wrong')).toBe(401);
      }
      expect(await loginAs(outside(11), PASSWORD)).toBe(429);
      expect(await loginAs(lan, PASSWORD)).toBe(200);

      jest.setSystemTime(T0 + 31 * MINUTE);
      for (let i = 0; i < 10; i++) {
        expect(await loginAs(localProcess, 'wrong')).toBe(401);
      }
      expect(await loginAs(outside(12), PASSWORD)).toBe(200);
    });

    it('비밀값이 없으면 내부망 로그인은 로컬 프로세스와 한 잠금을 나눠 쓴다', async () => {
      const localProcess = request(withoutSecret, '127.0.0.1');
      const lan = request(withoutSecret, '127.0.0.1', {
        'x-real-ip': '10.0.0.5',
      });
      expect(lan).toEqual({ ip: '10.0.0.5', verified: false });

      for (let i = 0; i < 10; i++) {
        expect(await loginAs(localProcess, 'wrong')).toBe(401);
      }

      expect(await loginAs(lan, PASSWORD)).toBe(429);
    });
  });

  it.each([
    ['허용 목록에 적은 주소', '198.51.100.20', '198.51.100.20'],
    ['허용 목록 대역 안의 주소', '198.51.100.21', '198.51.100.0/24'],
  ])('%s 는 20번 틀려도 IP 로 막히지 않는다', async (_label, ip, allowlist) => {
    await build({ allowlist });

    expect(new Set(await statuses(ip, 20))).toEqual(new Set([401]));
    expect(await login(ip, PASSWORD)).toBe(200);
    expect(harness.ipBans.rows.has(ip)).toBe(false);
    expect(await firewalled()).not.toContain(ip);
  });

  it('허용 목록 주소도 15분에 30번 틀리면 그 출처에서 계정이 잠긴다', async () => {
    await build({ allowlist: '198.51.100.0/24' });

    expect(tally(await statuses('198.51.100.22', 31))).toEqual({
      401: 30,
      429: 1,
    });
    expect(await login('10.0.0.5', PASSWORD)).toBe(200);
    expect(harness.ipBans.rows.size).toBe(0);
  });

  it('넓게 적은 허용 대역은 차단에서 보호만 하고 로그인 예외는 주지 않는다', async () => {
    await build({ allowlist: '198.0.0.0/8' });
    const ip = '198.51.100.5';

    expect(await statuses(ip, 6)).toEqual([401, 401, 401, 401, 401, 429]);
    expect(harness.ipBans.rows.has(ip)).toBe(false);
  });

  it('SSH 내 IP 목록의 주소는 20번 틀려도 IP 로 막히지 않는다', async () => {
    const ip = '192.0.2.30';
    await harness.addKnownIp(ip);

    expect(new Set(await statuses(ip, 20))).toEqual(new Set([401]));
    expect(await login(ip, PASSWORD)).toBe(200);
    expect(harness.ipBans.rows.has(ip)).toBe(false);
  });

  it('내부 주소는 IP 로 막지 않지만 계정 잠금은 받는다', async () => {
    const email = 'admin@example.com';

    for (const ip of ['10.0.0.5', '100.64.0.9', '172.16.0.9']) {
      expect(await statuses(ip, 3, email)).toEqual([401, 401, 401]);
    }
    expect(await statuses('192.168.1.9', 2, email)).toEqual([401, 429]);
    expect(harness.ipBans.rows.size).toBe(0);
  });

  it('프록시 주소(루프백)는 허용 목록에 있어도 계정 규칙을 받는다', async () => {
    await build({ allowlist: '127.0.0.1,::1' });
    const email = 'admin@example.com';

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

  describe('IPv6', () => {
    const inBlock = (n: number) => `2001:db8:1:2::${n.toString(16)}`;

    it('/64 안에서 주소를 바꿔 가며 틀려도 대역째 막는다', async () => {
      for (let i = 1; i <= 5; i++) {
        expect(await login(inBlock(i), 'wrong')).toBe(401);
      }

      expect(await login(inBlock(99), PASSWORD)).toBe(429);
      expect(harness.ipBans.rows.get('2001:db8:1:2::/64')?.active).toBe(true);
      expect(await login('2001:db8:1:3::1', PASSWORD)).toBe(200);
    });

    it('하루 20번이면 /64 대역 하나를 방화벽에 올린다', async () => {
      for (let round = 0; round < 4; round++) {
        jest.setSystemTime(T0 + round * 2 * 60 * MINUTE);
        for (let i = 1; i <= 5; i++)
          await login(inBlock(round * 10 + i), 'wrong');
      }

      expect(await firewalled()).toEqual(['2001:db8:1:2::/64']);
    });

    it('SSH 내 IP 가 든 /64 는 nginx·방화벽에 올리지 않고 로그인만 돌려보낸다', async () => {
      await harness.addKnownIp(inBlock(0x77));
      for (let i = 1; i <= 5; i++) await login(inBlock(i), 'wrong');

      expect(await login(inBlock(99), PASSWORD)).toBe(429);
      expect(harness.ipBans.rows.size).toBe(0);
      expect(await login(inBlock(0x77), PASSWORD)).toBe(200);
    });
  });

  it('성공과 실패를 IP 와 계정과 함께 남기고, 돌려보낸 시도는 감사 기록에 쓰지 않는다', async () => {
    await login('192.0.2.70', 'wrong');
    await login('192.0.2.70', PASSWORD);
    await login('192.0.2.70', 'wrong', 'ghost@example.com');
    const banned = '203.0.113.70';
    await statuses(banned, 7);

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

    expect(
      harness.attempts.rows.filter(
        (row) => row.ip === banned && row.result === 'refused',
      ),
    ).toHaveLength(2);
    expect(
      harness.audits
        .filter(
          (a) =>
            a.targetId === banned ||
            (a.metadata as { ip?: string } | undefined)?.ip === banned,
        )
        .map((a) => a.action),
    ).toEqual([...Array(5).fill('login.failure'), 'login.ip-ban']);
  });

  it('대소문자나 보이지 않는 문자만 바꾼 이메일도 같은 계정으로 센다', async () => {
    const variants = [
      'Admin@Example.com',
      ' admin@example.com',
      'admin@example.com‮',
      'ad\u0000min@example.com',
      '⁦ADMIN@example.com',
    ];
    for (let i = 1; i <= 10; i++) {
      await login(`198.51.100.${150 + i}`, 'wrong', variants[i % 5]);
    }

    expect(await login('192.0.2.80', PASSWORD)).toBe(429);
    expect(
      new Set(
        harness.attempts.rows
          .filter((row) => row.ip?.startsWith('198.51.100.15'))
          .map((row) => row.account),
      ),
    ).toEqual(new Set(['admin@example.com']));
  });

  it('없는 계정과 틀린 비밀번호는 같은 오류를 낸다', async () => {
    const unknown = useCase.execute(
      { email: 'nobody@example.com', password: 'wrong' },
      { ip: '192.0.2.90', ipVerified: true, userAgent: null },
    );
    const wrong = useCase.execute(
      { email: 'admin@example.com', password: 'wrong' },
      { ip: '192.0.2.91', ipVerified: true, userAgent: null },
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

  it('30일 지난 로그인 기록과, 만료로 풀린 지 30일 지난 IP 차단 행을 지운다', async () => {
    await login('192.0.2.95', 'wrong');
    await login('192.0.2.95', PASSWORD);
    await statuses('203.0.113.95', 5);
    const ban = harness.ipBans.rows.get('203.0.113.95');
    expect(ban?.active).toBe(true);
    jest.setSystemTime(T0 + 31 * 24 * 60 * MINUTE);
    await login('192.0.2.95', PASSWORD);
    if (ban) ban.active = false;

    await harness.guard.prune();

    expect(harness.attempts.rows.map((row) => row.at)).toEqual([
      new Date(T0 + 31 * 24 * 60 * MINUTE),
    ]);
    expect(harness.ipBans.rows.has('203.0.113.95')).toBe(false);
  });
});
