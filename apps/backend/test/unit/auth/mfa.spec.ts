import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoginUseCase } from '@/auth/application/use-cases/login.use-case';
import { randomBytes } from 'node:crypto';
import { MfaConfig } from '@/auth/mfa/application/mfa-config';
import { RECOVERY_CODE_COUNT } from '@/auth/mfa/domain/recovery-codes';
import {
  decodeBase32,
  encodeBase32,
  matchTotp,
  totpCode,
  totpStep,
} from '@/auth/mfa/domain/totp';
import { Logger } from '@nestjs/common';
import {
  MFA_CHALLENGES_PER_USER,
  MFA_CHALLENGES_TOTAL,
  MfaChallengeStore,
} from '@/auth/mfa/application/mfa-challenge.store';
import { browser } from './auth-session.fake';
import { PASSWORD, account, closeMfaHarnesses, mfaHarness } from './mfa.fake';

const LOGIN_AT = new Date('2026-03-01T09:00:10.000Z');
const STEP_MS = 30 * 1000;

afterEach(closeMfaHarnesses);

function codeAt(secret: string, at: Date) {
  return totpCode(secret, totpStep(at));
}

async function expectMfaError(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => {
      throw new Error('expected rejection');
    },
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(HttpException);
  expect((error as HttpException).getResponse()).toMatchObject({ code });
  return error as HttpException;
}

describe('TOTP', () => {
  // RFC 6238 부록 B 의 SHA-1 시험값. 8자리 값의 끝 6자리가 6자리 코드다.
  const rfcSecret = encodeBase32(Buffer.from('12345678901234567890'));
  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
    [20000000000, '353130'],
  ])('RFC 6238 시험값과 같은 코드를 만든다 (T=%i)', (seconds, expected) => {
    expect(codeAt(rfcSecret, new Date(seconds * 1000))).toBe(expected);
  });

  it('base32 를 오가도 비밀값이 그대로다', () => {
    const bytes = randomBytes(20);
    expect(decodeBase32(encodeBase32(bytes))).toEqual(bytes);
  });

  it('앞뒤 한 주기까지 받고 그 밖은 받지 않는다', () => {
    const secret = encodeBase32(randomBytes(20));
    const step = totpStep(LOGIN_AT);
    const accepts = (offset: number) =>
      matchTotp(secret, totpCode(secret, step + offset), LOGIN_AT, null);

    expect(accepts(-1)).toBe(step - 1);
    expect(accepts(0)).toBe(step);
    expect(accepts(1)).toBe(step + 1);
    expect(accepts(-2)).toBeNull();
    expect(accepts(2)).toBeNull();
  });

  it('이미 쓴 step 과 그보다 오래된 코드는 받지 않는다', () => {
    const secret = encodeBase32(randomBytes(20));
    const step = totpStep(LOGIN_AT);
    const code = totpCode(secret, step);

    expect(matchTotp(secret, code, LOGIN_AT, step)).toBeNull();
    expect(
      matchTotp(secret, totpCode(secret, step - 1), LOGIN_AT, step - 1),
    ).toBeNull();
    expect(matchTotp(secret, code, LOGIN_AT, step - 1)).toBe(step);
  });
});

describe('MfaConfig', () => {
  const key = randomBytes(32);
  const config = new MfaConfig(key, new Set(['admin']), 'kscold-control');

  it('봉인한 비밀값을 같은 사용자 id 로만 다시 연다', () => {
    const sealed = config.sealSecret('user-1', 'JBSWY3DPEHPK3PXP');

    expect(sealed).not.toContain('JBSWY3DPEHPK3PXP');
    expect(config.openSecret('user-1', sealed)).toBe('JBSWY3DPEHPK3PXP');
    expect(() => config.openSecret('user-2', sealed)).toThrow();
    const otherKey = new MfaConfig(
      randomBytes(32),
      new Set(),
      'kscold-control',
    );
    expect(() => otherKey.openSecret('user-1', sealed)).toThrow();
  });

  it('잘라 낸 인증 태그나 길이가 다른 IV 로는 열지 않는다', () => {
    const sealed = config.sealSecret('user-1', 'JBSWY3DPEHPK3PXP');
    const [prefix, iv, tag, ciphertext] = sealed.split('.');
    const reseal = (nextIv: Buffer, nextTag: Buffer) =>
      [
        prefix,
        nextIv.toString('base64'),
        nextTag.toString('base64'),
        ciphertext,
      ].join('.');
    const ivBytes = Buffer.from(iv, 'base64');
    const tagBytes = Buffer.from(tag, 'base64');

    expect(() =>
      config.openSecret('user-1', reseal(ivBytes, tagBytes.subarray(0, 4))),
    ).toThrow();
    expect(() =>
      config.openSecret(
        'user-1',
        reseal(Buffer.concat([ivBytes, Buffer.alloc(4)]), tagBytes),
      ),
    ).toThrow();
    expect(config.openSecret('user-1', reseal(ivBytes, tagBytes))).toBe(
      'JBSWY3DPEHPK3PXP',
    );
  });

  it('필수 역할을 비워 두면 기동할 때 경고한다', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const boot = (roles: string) =>
      MfaConfig.fromConfig(
        new ConfigService({
          CONTROL_MFA_ENCRYPTION_KEY: key.toString('base64'),
          CONTROL_MFA_REQUIRED_ROLES: roles,
        }),
      );

    boot('admin');
    expect(warn).not.toHaveBeenCalled();
    boot(' , ');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('CONTROL_MFA_REQUIRED_ROLES is empty'),
    );
    warn.mockRestore();
  });

  it('키가 없거나 32바이트가 아니면 기동을 멈춘다', () => {
    const boot = (value?: string) => () =>
      MfaConfig.fromConfig(
        new ConfigService(
          value === undefined ? {} : { CONTROL_MFA_ENCRYPTION_KEY: value },
        ),
      );

    expect(boot()).toThrow(/CONTROL_MFA_ENCRYPTION_KEY/);
    expect(boot('')).toThrow(/CONTROL_MFA_ENCRYPTION_KEY/);
    expect(boot(randomBytes(16).toString('base64'))).toThrow(
      /CONTROL_MFA_ENCRYPTION_KEY/,
    );
    expect(boot(key.toString('base64'))).not.toThrow();
  });

  it('역할 설정이 없으면 admin 과 super_admin 에 등록을 요구한다', () => {
    const defaults = MfaConfig.fromConfig(
      new ConfigService({ CONTROL_MFA_ENCRYPTION_KEY: key.toString('base64') }),
    );

    expect(defaults.requiresMfa(['super_admin'])).toBe(true);
    expect(defaults.requiresMfa(['admin'])).toBe(true);
    expect(defaults.requiresMfa(['operator', 'read_only'])).toBe(false);
  });
});

describe('MfaService', () => {
  beforeEach(() => jest.useFakeTimers({ now: LOGIN_AT }));
  afterEach(() => jest.useRealTimers());

  async function enrolledAdmin() {
    const harness = await mfaHarness();
    const admin = harness.addUser(
      account('00000000-0000-4000-8000-0000000000a1', 'admin'),
    );
    const step = await harness.mfa.afterPassword(admin as any);
    if (step?.kind !== 'mfa_enrollment_required') throw new Error(step?.kind);
    const login = await harness.mfa.completeEnrollment(
      {
        challenge: step.challenge.token,
        code: codeAt(step.enrollment.secret, new Date()),
      },
      browser,
    );
    return { ...harness, admin, secret: step.enrollment.secret, login };
  }

  async function verifyChallenge(
    harness: Awaited<ReturnType<typeof mfaHarness>>,
  ) {
    const user = [...harness.users.values()][0];
    const step = await harness.mfa.afterPassword(user as any);
    if (step?.kind !== 'mfa_required') throw new Error(step?.kind);
    return step.challenge.token;
  }

  it('2단계가 필요 없는 일반 계정은 challenge 없이 넘긴다', async () => {
    const harness = await mfaHarness();
    const user = harness.addUser(account('user-1', 'operator'));

    await expect(harness.mfa.afterPassword(user as any)).resolves.toBeNull();
  });

  it('필수 역할 계정은 등록을 마쳐야 mfa 세션과 복구 코드 10개를 받는다', async () => {
    const harness = await mfaHarness();
    const admin = harness.addUser(
      account('00000000-0000-4000-8000-0000000000a1', 'admin'),
    );
    const earlier = await harness.sessions.open(admin.id, browser);

    const step = await harness.mfa.afterPassword(admin as any);
    expect(step).toMatchObject({
      kind: 'mfa_enrollment_required',
      enrollment: {
        otpauthUri: expect.stringMatching(
          /^otpauth:\/\/totp\/kscold-control:.+\?secret=[A-Z2-7]{32}&issuer=kscold-control/,
        ),
      },
    });
    if (step?.kind !== 'mfa_enrollment_required') return;

    const login = await harness.mfa.completeEnrollment(
      {
        challenge: step.challenge.token,
        code: codeAt(step.enrollment.secret, new Date()),
      },
      browser,
    );

    expect(login.recoveryCodes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(login.recoveryCodes).size).toBe(RECOVERY_CODE_COUNT);
    const claims = await harness.verifier.verifyToken(login.accessToken);
    expect(harness.repository.rows.get(claims.sid)).toMatchObject({
      assurance: 'mfa',
      revokedAt: null,
    });
    expect(harness.repository.rows.get(earlier.id)?.revokedAt).not.toBeNull();
    const stored = harness.enrollments.rows.get(admin.id)!;
    expect(stored.sealedTotpSecret).not.toContain(step.enrollment.secret);
    expect(stored.recoveryCodeHashes.join()).not.toContain(
      login.recoveryCodes[0].replace(/-/g, ''),
    );
  });

  it('등록용 challenge 로는 로그인 확인을 할 수 없다', async () => {
    const harness = await mfaHarness();
    const admin = harness.addUser(
      account('00000000-0000-4000-8000-0000000000a1', 'admin'),
    );
    const step = await harness.mfa.afterPassword(admin as any);
    if (step?.kind !== 'mfa_enrollment_required') return;

    await expectMfaError(
      harness.mfa.verify(
        {
          challenge: step.challenge.token,
          method: 'totp',
          code: codeAt(step.enrollment.secret, new Date()),
        },
        browser,
      ),
      'MFA_CHALLENGE_EXPIRED',
    );
  });

  it('등록한 계정은 올바른 OTP 로 mfa 세션을 연다', async () => {
    const harness = await enrolledAdmin();
    jest.setSystemTime(LOGIN_AT.getTime() + STEP_MS);

    const login = await harness.mfa.verify(
      {
        challenge: await verifyChallenge(harness),
        method: 'totp',
        code: codeAt(harness.secret, new Date()),
      },
      browser,
    );

    const claims = await harness.verifier.verifyToken(login.accessToken);
    expect(harness.repository.rows.get(claims.sid)?.assurance).toBe('mfa');
  });

  it('같은 OTP 를 두 번 내면 두 번째는 거절한다', async () => {
    const harness = await enrolledAdmin();
    jest.setSystemTime(LOGIN_AT.getTime() + STEP_MS);
    const code = codeAt(harness.secret, new Date());

    await harness.mfa.verify(
      { challenge: await verifyChallenge(harness), method: 'totp', code },
      browser,
    );
    await expectMfaError(
      harness.mfa.verify(
        { challenge: await verifyChallenge(harness), method: 'totp', code },
        browser,
      ),
      'MFA_CODE_INVALID',
    );
    expect(harness.failures()).toEqual([
      { email: harness.admin.email, reason: 'wrong-otp' },
    ]);
  });

  it('등록할 때 쓴 OTP 로는 바로 다시 로그인할 수 없다', async () => {
    const harness = await enrolledAdmin();

    await expectMfaError(
      harness.mfa.verify(
        {
          challenge: await verifyChallenge(harness),
          method: 'totp',
          code: codeAt(harness.secret, new Date()),
        },
        browser,
      ),
      'MFA_CODE_INVALID',
    );
  });

  it('복구 코드는 한 번만 쓸 수 있고 대소문자와 줄표를 가리지 않는다', async () => {
    const harness = await enrolledAdmin();
    const [code] = harness.login.recoveryCodes;

    const login = await harness.mfa.verify(
      {
        challenge: await verifyChallenge(harness),
        method: 'recovery',
        code: code.toLowerCase().replace(/-/g, ' '),
      },
      browser,
    );
    expect(login.kind).toBe('authenticated');
    await expectMfaError(
      harness.mfa.verify(
        { challenge: await verifyChallenge(harness), method: 'recovery', code },
        browser,
      ),
      'MFA_CODE_INVALID',
    );
    await expect(
      harness.mfa.status({ id: harness.admin.id, roles: ['admin'] }),
    ).resolves.toMatchObject({
      enabled: true,
      recoveryCodesRemaining: RECOVERY_CODE_COUNT - 1,
      required: true,
    });
  });

  it('challenge 는 한 번 쓰면 닫힌다', async () => {
    const harness = await enrolledAdmin();
    jest.setSystemTime(LOGIN_AT.getTime() + STEP_MS);
    const challenge = await verifyChallenge(harness);

    await harness.mfa.verify(
      { challenge, method: 'totp', code: codeAt(harness.secret, new Date()) },
      browser,
    );
    jest.setSystemTime(LOGIN_AT.getTime() + 2 * STEP_MS);
    await expectMfaError(
      harness.mfa.verify(
        { challenge, method: 'totp', code: codeAt(harness.secret, new Date()) },
        browser,
      ),
      'MFA_CHALLENGE_EXPIRED',
    );
  });

  it('5분이 지난 challenge 는 맞는 코드여도 받지 않는다', async () => {
    const harness = await enrolledAdmin();
    const challenge = await verifyChallenge(harness);
    jest.setSystemTime(LOGIN_AT.getTime() + 5 * 60 * 1000);

    await expectMfaError(
      harness.mfa.verify(
        { challenge, method: 'totp', code: codeAt(harness.secret, new Date()) },
        browser,
      ),
      'MFA_CHALLENGE_EXPIRED',
    );
  });

  it('다섯 번 틀리면 challenge 를 닫고 실패마다 로그인 실패로 넘긴다', async () => {
    const harness = await enrolledAdmin();
    const challenge = await verifyChallenge(harness);
    const wrong = { challenge, method: 'totp' as const, code: '000000' };
    if (codeAt(harness.secret, new Date()) === '000000') wrong.code = '111111';

    for (const remaining of [4, 3, 2, 1]) {
      const error = await expectMfaError(
        harness.mfa.verify(wrong, browser),
        'MFA_CODE_INVALID',
      );
      expect(error.getResponse()).toMatchObject({
        remainingAttempts: remaining,
      });
    }
    await expectMfaError(
      harness.mfa.verify(wrong, browser),
      'MFA_CHALLENGE_EXPIRED',
    );
    expect(harness.failures()).toHaveLength(5);
    jest.setSystemTime(LOGIN_AT.getTime() + STEP_MS);
    await expectMfaError(
      harness.mfa.verify(
        { challenge, method: 'totp', code: codeAt(harness.secret, new Date()) },
        browser,
      ),
      'MFA_CHALLENGE_EXPIRED',
    );
  });

  it('복구 코드를 다시 만들려면 지금 OTP 가 맞아야 하고 예전 코드는 버린다', async () => {
    const harness = await enrolledAdmin();
    jest.setSystemTime(LOGIN_AT.getTime() + STEP_MS);

    const refused = await expectMfaError(
      harness.mfa.regenerateRecoveryCodes(harness.admin, '000000', browser),
      'MFA_CODE_INVALID',
    );
    expect(refused.getStatus()).toBe(403);
    const { recoveryCodes } = await harness.mfa.regenerateRecoveryCodes(
      harness.admin,
      codeAt(harness.secret, new Date()),
      browser,
    );

    expect(recoveryCodes).toHaveLength(RECOVERY_CODE_COUNT);
    await expectMfaError(
      harness.mfa.verify(
        {
          challenge: await verifyChallenge(harness),
          method: 'recovery',
          code: harness.login.recoveryCodes[1],
        },
        browser,
      ),
      'MFA_CODE_INVALID',
    );
    await expect(
      harness.mfa.verify(
        {
          challenge: await verifyChallenge(harness),
          method: 'recovery',
          code: recoveryCodes[0],
        },
        browser,
      ),
    ).resolves.toMatchObject({ kind: 'authenticated' });
  });

  it('이미 등록한 계정은 등록을 다시 시작할 수 없다', async () => {
    const harness = await enrolledAdmin();

    const error = await expectMfaError(
      harness.mfa.startEnrollment(
        { ...harness.admin, sessionId: 'unused' },
        PASSWORD,
        browser,
      ),
      'MFA_ALREADY_ENABLED',
    );
    expect(error.getStatus()).toBe(409);
  });
});

describe('MfaService 동시 요청과 시도 한도', () => {
  beforeEach(() => jest.useFakeTimers({ now: LOGIN_AT }));
  afterEach(() => jest.useRealTimers());

  async function enrolled() {
    const harness = await mfaHarness();
    const admin = harness.addUser(
      account('00000000-0000-4000-8000-0000000000a1', 'admin'),
    );
    const step = await harness.mfa.afterPassword(admin as any);
    if (step?.kind !== 'mfa_enrollment_required') throw new Error(step?.kind);
    await harness.mfa.completeEnrollment(
      {
        challenge: step.challenge.token,
        code: codeAt(step.enrollment.secret, new Date()),
      },
      browser,
    );
    jest.setSystemTime(LOGIN_AT.getTime() + STEP_MS);
    const secret = step.enrollment.secret;
    const right = () => codeAt(secret, new Date());
    const wrong = () => (right() === '000000' ? '111111' : '000000');
    const challenge = async () => {
      const next = await harness.mfa.afterPassword(admin as any);
      if (next?.kind !== 'mfa_required') throw new Error(next?.kind);
      return next.challenge.token;
    };
    // 시도마다 다른 바깥 주소를 써서 IP 차단 없이 계정 한도만 본다.
    let ips = 0;
    const guess = (token: string, code: string) =>
      harness.mfa.verify(
        { challenge: token, method: 'totp', code },
        { ip: `198.51.100.${++ips}`, ipVerified: true, userAgent: null },
      );
    const statusOf = (promise: Promise<unknown>) =>
      promise.then(
        () => 200,
        (error: HttpException) => error.getStatus(),
      );
    async function failTimes(count: number) {
      for (let done = 0; done < count;) {
        const token = await challenge();
        for (let i = 0; i < 4 && done < count; i++, done++) {
          await expect(statusOf(guess(token, wrong()))).resolves.toBe(401);
        }
      }
    }
    return {
      ...harness,
      admin,
      right,
      wrong,
      challenge,
      guess,
      statusOf,
      failTimes,
    };
  }

  it('여러 challenge 로 동시에 틀린 코드를 보내도 15분에 10번을 넘지 못한다', async () => {
    const { challenge, guess, statusOf, failTimes, wrong, right, failures } =
      await enrolled();
    await failTimes(8);

    const tokens = await Promise.all([challenge(), challenge(), challenge()]);
    const statuses = await Promise.all(
      tokens.map((token) => statusOf(guess(token, wrong()))),
    );

    expect(statuses.sort()).toEqual([401, 401, 429]);
    expect(failures()).toHaveLength(10);
    await expect(statusOf(guess(await challenge(), right()))).resolves.toBe(
      429,
    );
  });

  it('같은 challenge 로 확인 중이면 다른 요청은 409 로 돌려보낸다', async () => {
    const { challenge, guess, statusOf, right } = await enrolled();
    const token = await challenge();

    const [first, second] = await Promise.all([
      statusOf(guess(token, right())),
      guess(token, right()).catch((error: HttpException) => error),
    ]);

    expect(first).toBe(200);
    expect((second as HttpException).getStatus()).toBe(409);
    expect((second as HttpException).getResponse()).toMatchObject({
      code: 'MFA_CHECK_IN_PROGRESS',
    });
  });

  it('맞는 코드는 실패로 세지 않는다', async () => {
    const { challenge, guess, statusOf, failTimes, wrong, right } =
      await enrolled();
    await failTimes(9);

    await expect(statusOf(guess(await challenge(), right()))).resolves.toBe(
      200,
    );
    await expect(statusOf(guess(await challenge(), wrong()))).resolves.toBe(
      401,
    );
    await expect(statusOf(guess(await challenge(), wrong()))).resolves.toBe(
      429,
    );
  });

  it('OTP 로그인 성공을 감사 기록에 남기고, 잠긴 계정은 15분 뒤 풀린다', async () => {
    const {
      challenge,
      guess,
      statusOf,
      failTimes,
      right,
      admin,
      auditActions,
      loginGuard,
    } = await enrolled();

    await guess(await challenge(), right());
    expect(auditActions('login.mfa-success')).toEqual([
      expect.objectContaining({ actorId: admin.id, targetId: admin.id }),
    ]);

    await failTimes(10);
    for (let i = 0; i < 3; i++) {
      await expect(statusOf(guess(await challenge(), right()))).resolves.toBe(
        429,
      );
    }
    expect(
      loginGuard.attempts.rows
        .filter((row) => row.result === 'refused')
        .map((row) => row.reason),
    ).toEqual(['account-locked', 'account-locked', 'account-locked']);

    jest.setSystemTime(Date.now() + 15 * 60 * 1000 + 1);
    await expect(statusOf(guess(await challenge(), right()))).resolves.toBe(
      200,
    );
  });
});

describe('비밀번호와 OTP 로그인에 로그인 차단을 함께 건다', () => {
  const ATTACKER = '198.51.100.20';
  const OWNER = '192.0.2.50';

  beforeEach(() => jest.useFakeTimers({ now: LOGIN_AT }));
  afterEach(() => jest.useRealTimers());

  async function enrolledLogin() {
    const harness = await mfaHarness({ allowlist: OWNER });
    const admin = harness.addUser(
      account('00000000-0000-4000-8000-0000000000a1', 'admin'),
    );
    const users = {
      findByEmail: async (email: string) =>
        email === admin.email ? admin : null,
      findByIdWithRoles: async (id: string) => harness.users.get(id) ?? null,
    };
    const useCase = new LoginUseCase(
      users as any,
      harness.sessions,
      harness.loginGuard.guard,
      harness.mfa,
    );
    const client = (ip: string) => ({ ip, ipVerified: true, userAgent: null });
    const passwordStep = (ip: string) =>
      useCase.execute({ email: admin.email, password: PASSWORD }, client(ip));

    const first = await passwordStep(OWNER);
    if (first.kind !== 'mfa_enrollment_required') throw new Error(first.kind);
    await harness.mfa.completeEnrollment(
      {
        challenge: first.challenge.token,
        code: codeAt(first.enrollment.secret, new Date()),
      },
      client(OWNER),
    );
    jest.setSystemTime(LOGIN_AT.getTime() + STEP_MS);
    const right = () => codeAt(first.enrollment.secret, new Date());
    const wrong = () => (right() === '000000' ? '111111' : '000000');

    const login = async (
      ip: string,
      method: 'totp' | 'recovery',
      code: string,
    ) => {
      try {
        const step = await passwordStep(ip);
        if (step.kind !== 'mfa_required') throw new Error(step.kind);
        await harness.mfa.verify(
          { challenge: step.challenge.token, method, code },
          client(ip),
        );
        return 200;
      } catch (error) {
        if (error instanceof HttpException) return error.getStatus();
        throw error;
      }
    };
    return { ...harness, admin, right, wrong, login, passwordStep, client };
  }

  it('한 IP 에서 틀린 2단계 코드가 다섯 번 쌓이면 그 IP 를 막고 맞는 비밀번호도 돌려보낸다', async () => {
    const { login, wrong, right, loginGuard, failures, admin } =
      await enrolledLogin();

    for (let i = 0; i < 4; i++) {
      await expect(login(ATTACKER, 'totp', wrong())).resolves.toBe(401);
    }
    await expect(login(ATTACKER, 'recovery', 'AAAA-BBBB-CCCC')).resolves.toBe(
      401,
    );

    expect(failures()).toEqual([
      ...Array(4).fill({ email: admin.email, reason: 'wrong-otp' }),
      { email: admin.email, reason: 'wrong-recovery-code' },
    ]);
    expect(loginGuard.ipBans.rows.get(ATTACKER)).toMatchObject({
      active: true,
      source: 'auto-login',
    });
    await expect(login(ATTACKER, 'totp', right())).resolves.toBe(429);
    expect(loginGuard.attempts.rows.at(-1)).toMatchObject({
      ip: ATTACKER,
      result: 'refused',
      reason: 'ip-banned',
    });
  });

  it('바깥에서 계정이 잠겨도 허용 목록 주소에서는 비밀번호와 OTP 로 들어온다', async () => {
    const {
      login,
      wrong,
      right,
      loginGuard,
      passwordStep,
      client,
      mfa,
      verifier,
      repository,
    } = await enrolledLogin();
    for (let i = 1; i <= 10; i++) {
      await expect(login(`203.0.113.${i}`, 'totp', wrong())).resolves.toBe(401);
    }
    await expect(login('203.0.113.99', 'totp', right())).resolves.toBe(429);
    expect(loginGuard.ipBans.rows.size).toBe(0);

    const step = await passwordStep(OWNER);
    if (step.kind !== 'mfa_required') throw new Error(step.kind);
    const session = await mfa.verify(
      { challenge: step.challenge.token, method: 'totp', code: right() },
      client(OWNER),
    );

    const claims = await verifier.verifyToken(session.accessToken);
    expect(repository.rows.get(claims.sid)).toMatchObject({
      ip: OWNER,
      assurance: 'mfa',
    });
  });
});

describe('로그인한 화면에서 2단계 인증 켜기', () => {
  beforeEach(() => jest.useFakeTimers({ now: LOGIN_AT }));
  afterEach(() => jest.useRealTimers());

  async function signedInOperator() {
    const harness = await mfaHarness();
    const user = harness.addUser(account('user-1', 'operator'));
    const current = await harness.sessions.signIn(
      user as any,
      browser,
      'password',
    );
    const sessionId = harness.jwtService.decode<{ sid: string }>(
      current.accessToken,
    ).sid;
    const other = await harness.sessions.open(user.id, {
      ip: '198.51.100.7',
      userAgent: null,
    });
    return { ...harness, user, sessionId, other };
  }

  it('토큰만으로는 등록을 시작할 수 없고 비밀번호가 맞아야 한다', async () => {
    const { mfa, user, sessionId, failures } = await signedInOperator();

    const refused = await expectMfaError(
      mfa.startEnrollment({ ...user, sessionId }, 'stolen-token-only', browser),
      'MFA_PASSWORD_INVALID',
    );
    expect(refused.getStatus()).toBe(403);
    expect(failures()).toEqual([
      { email: user.email, reason: 'wrong-password' },
    ]);
    await expect(
      mfa.startEnrollment({ ...user, sessionId }, PASSWORD, browser),
    ).resolves.toMatchObject({ enrollment: { secret: expect.any(String) } });
  });

  it('등록을 마치면 새 세션 없이 지금 세션을 mfa 로 올리고 다른 세션만 끊는다', async () => {
    const { mfa, user, sessionId, other, repository, verifier } =
      await signedInOperator();
    const sessionsBefore = repository.rows.size;

    const started = await mfa.startEnrollment(
      { ...user, sessionId },
      PASSWORD,
      browser,
    );
    const login = await mfa.completeEnrollment(
      {
        challenge: started.challenge.token,
        code: codeAt(started.enrollment.secret, new Date()),
      },
      { ip: '192.0.2.44', ipVerified: true, userAgent: null },
    );

    expect(repository.rows.size).toBe(sessionsBefore);
    const claims = await verifier.verifyToken(login.accessToken);
    expect(claims.sid).toBe(sessionId);
    expect(repository.rows.get(sessionId)).toMatchObject({
      assurance: 'mfa',
      revokedAt: null,
    });
    expect(repository.rows.get(other.id)?.revokedAt).not.toBeNull();
    expect(login.recoveryCodes).toHaveLength(RECOVERY_CODE_COUNT);
  });

  it('시작한 세션이 그사이 끝났으면 다른 세션을 모두 끊고 mfa 세션을 새로 연다', async () => {
    const { mfa, user, sessionId, other, sessions, repository, verifier } =
      await signedInOperator();
    const started = await mfa.startEnrollment(
      { ...user, sessionId },
      PASSWORD,
      browser,
    );
    await sessions.revoke(sessionId);

    const login = await mfa.completeEnrollment(
      {
        challenge: started.challenge.token,
        code: codeAt(started.enrollment.secret, new Date()),
      },
      browser,
    );

    const claims = await verifier.verifyToken(login.accessToken);
    expect(claims.sid).not.toBe(sessionId);
    expect(repository.rows.get(claims.sid)?.assurance).toBe('mfa');
    expect(repository.rows.get(other.id)?.revokedAt).not.toBeNull();
  });
});

describe('MfaChallengeStore', () => {
  const verify = (userId: string) => ({ purpose: 'verify' as const, userId });

  it(`한 사용자의 challenge 는 ${MFA_CHALLENGES_PER_USER}개까지만 살리고 가장 오래된 것부터 닫는다`, () => {
    const store = new MfaChallengeStore();
    const tokens = Array.from(
      { length: MFA_CHALLENGES_PER_USER + 1 },
      () => store.issue(verify('user-1')).token,
    );
    const other = store.issue(verify('user-2')).token;

    expect(store.begin(tokens[0], 'verify')).toBeNull();
    for (const token of tokens.slice(1)) {
      expect(store.begin(token, 'verify')).toEqual(verify('user-1'));
    }
    expect(store.begin(other, 'verify')).toEqual(verify('user-2'));
  });

  it(`전체 challenge 가 ${MFA_CHALLENGES_TOTAL}개를 넘으면 가장 오래된 것부터 닫는다`, () => {
    const store = new MfaChallengeStore();
    const first = store.issue(verify('user-0')).token;
    const second = store.issue(verify('user-1')).token;
    for (let i = 2; i <= MFA_CHALLENGES_TOTAL; i++) {
      store.issue(verify(`user-${i}`));
    }

    expect(store.begin(first, 'verify')).toBeNull();
    expect(store.begin(second, 'verify')).toEqual(verify('user-1'));
  });

  it('확인이 끝나면 같은 challenge 를 다시 확인할 수 있다', () => {
    const store = new MfaChallengeStore();
    const { token } = store.issue(verify('user-1'));

    expect(store.begin(token, 'verify')).toEqual(verify('user-1'));
    expect(store.begin(token, 'verify')).toBe('busy');
    store.finish(token);
    expect(store.begin(token, 'verify')).toEqual(verify('user-1'));
  });
});
