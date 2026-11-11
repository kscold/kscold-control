import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { browser } from './auth-session.fake';
import { account, mfaHarness } from './mfa.fake';

const LOGIN_AT = new Date('2026-03-01T09:00:10.000Z');
const STEP_MS = 30 * 1000;

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
    const harness = mfaHarness();
    const admin = harness.addUser(
      account('00000000-0000-4000-8000-0000000000a1', 'admin'),
    );
    const step = await harness.mfa.secondStep(admin as any);
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

  async function verifyChallenge(harness: ReturnType<typeof mfaHarness>) {
    const user = [...harness.users.values()][0];
    const step = await harness.mfa.secondStep(user as any);
    if (step?.kind !== 'mfa_required') throw new Error(step?.kind);
    return step.challenge.token;
  }

  it('2단계가 필요 없는 일반 계정은 challenge 없이 넘긴다', async () => {
    const harness = mfaHarness();
    const user = harness.addUser(account('user-1', 'operator'));

    await expect(harness.mfa.secondStep(user as any)).resolves.toBeNull();
  });

  it('필수 역할 계정은 등록을 마쳐야 mfa 세션과 복구 코드 10개를 받는다', async () => {
    const harness = mfaHarness();
    const admin = harness.addUser(
      account('00000000-0000-4000-8000-0000000000a1', 'admin'),
    );
    const earlier = await harness.sessions.open(admin.id, browser);

    const step = await harness.mfa.secondStep(admin as any);
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
    expect(stored.totpSecret).not.toContain(step.enrollment.secret);
    expect(stored.recoveryCodeHashes.join()).not.toContain(
      login.recoveryCodes[0].replace(/-/g, ''),
    );
  });

  it('등록용 challenge 로는 로그인 확인을 할 수 없다', async () => {
    const harness = mfaHarness();
    const admin = harness.addUser(
      account('00000000-0000-4000-8000-0000000000a1', 'admin'),
    );
    const step = await harness.mfa.secondStep(admin as any);
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
    expect(harness.failures).toEqual([
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
    expect(harness.failures).toHaveLength(5);
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
      harness.mfa.startEnrollment(harness.admin),
      'MFA_ALREADY_ENABLED',
    );
    expect(error.getStatus()).toBe(409);
  });
});
