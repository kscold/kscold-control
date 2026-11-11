import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AuditLogService } from '../../../audit/application/services/audit-log.service';
import type { User } from '../../../rbac/domain/entities/user.entity';
import {
  type IUserRepository,
  USER_REPOSITORY,
} from '../../../rbac/domain/repositories/user.repository.interface';
import type {
  AuthenticatedLogin,
  LoginResult,
  MfaChallengeToken,
  MfaEnrollmentSetup,
} from '../../application/dto/login-result';
import {
  AuthSessionService,
  type SessionClient,
} from '../../application/services/auth-session.service';
import {
  MFA_ATTEMPT_GUARD,
  type MfaAttemptGuard,
} from '../domain/mfa-attempt-guard';
import {
  generateRecoveryCodes,
  normalizeRecoveryCode,
} from '../domain/recovery-codes';
import { generateTotpSecret, matchTotp, otpauthUri } from '../domain/totp';
import type { UserMfa } from '../domain/user-mfa.entity';
import {
  type IUserMfaRepository,
  USER_MFA_REPOSITORY,
} from '../domain/user-mfa.repository.interface';
import { MfaChallengeStore } from './mfa-challenge.store';
import { MfaConfig } from './mfa-config';

export type MfaMethod = 'totp' | 'recovery';

export type MfaErrorCode =
  | 'MFA_CODE_INVALID'
  | 'MFA_CHALLENGE_EXPIRED'
  | 'MFA_ALREADY_ENABLED'
  | 'MFA_NOT_ENABLED';

export interface MfaStatus {
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodesRemaining: number;
  required: boolean;
}

type Account = Pick<User, 'id' | 'email'>;

function mfaError(
  status: HttpStatus,
  code: MfaErrorCode,
  message: string,
  extra: Record<string, unknown> = {},
) {
  return new HttpException(
    { statusCode: status, code, message, ...extra },
    status,
  );
}

const challengeExpired = () =>
  mfaError(
    HttpStatus.UNAUTHORIZED,
    'MFA_CHALLENGE_EXPIRED',
    '인증 시간이 지났습니다. 처음부터 다시 로그인해주세요.',
  );

// 로그인한 요청에 401 을 주면 화면이 세션 확인부터 다시 하고 같은 요청을 한 번 더 보낸다.
const invalidCodeKeepingSession = () =>
  mfaError(
    HttpStatus.FORBIDDEN,
    'MFA_CODE_INVALID',
    '인증 코드가 맞지 않습니다.',
  );

const alreadyEnabled = () =>
  mfaError(
    HttpStatus.CONFLICT,
    'MFA_ALREADY_ENABLED',
    '이미 2단계 인증을 쓰고 있습니다.',
  );

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);

  constructor(
    @Inject(USER_MFA_REPOSITORY)
    private readonly enrollments: IUserMfaRepository,
    @Inject(USER_REPOSITORY)
    private readonly users: IUserRepository,
    @Inject(MFA_ATTEMPT_GUARD)
    private readonly guard: MfaAttemptGuard,
    private readonly config: MfaConfig,
    private readonly challenges: MfaChallengeStore,
    private readonly authSessions: AuthSessionService,
    private readonly audit: AuditLogService,
  ) {}

  async afterPassword(
    user: User,
  ): Promise<Exclude<LoginResult, AuthenticatedLogin> | null> {
    if (await this.enrollments.find(user.id)) {
      return {
        kind: 'mfa_required',
        challenge: this.challenges.issue({
          purpose: 'verify',
          userId: user.id,
        }),
      };
    }
    if (!this.config.requiresMfa(user.roles.map((role) => role.name))) {
      return null;
    }
    return { kind: 'mfa_enrollment_required', ...this.beginEnrollment(user) };
  }

  async startEnrollment(account: Account) {
    if (await this.enrollments.find(account.id)) throw alreadyEnabled();
    return this.beginEnrollment(account);
  }

  async verify(
    input: { challenge: string; method: MfaMethod; code: string },
    client: SessionClient,
  ): Promise<AuthenticatedLogin> {
    const now = new Date();
    const challenge = this.challenges.find(input.challenge, 'verify', now);
    const user =
      challenge && (await this.users.findByIdWithRoles(challenge.userId));
    if (!user) throw challengeExpired();

    const attempt = await this.guard.admit(client.ip, user.email);
    const enrollment = await this.enrollments.find(user.id);
    if (!enrollment) {
      this.challenges.consume(input.challenge);
      throw challengeExpired();
    }
    const accepted =
      input.method === 'totp'
        ? await this.acceptTotp(enrollment, input.code, now)
        : await this.acceptRecoveryCode(user.id, input.code);
    if (!accepted) return this.reject(input.challenge, attempt, input.method);
    if (!this.challenges.consume(input.challenge)) throw challengeExpired();

    if (input.method === 'recovery') {
      this.record(
        user,
        'mfa.recovery-code.use',
        `${user.email} 계정이 복구 코드로 로그인했습니다. 남은 복구 코드 ${enrollment.recoveryCodeHashes.length - 1}개`,
      );
    }
    return this.authSessions.signIn(user, client, 'mfa');
  }

  async completeEnrollment(
    input: { challenge: string; code: string },
    client: SessionClient,
  ): Promise<AuthenticatedLogin & { recoveryCodes: string[] }> {
    const now = new Date();
    const challenge = this.challenges.find(input.challenge, 'enroll', now);
    const user =
      challenge && (await this.users.findByIdWithRoles(challenge.userId));
    if (!challenge || !user) throw challengeExpired();

    const attempt = await this.guard.admit(client.ip, user.email);
    const step = matchTotp(challenge.secret, input.code, now, null);
    if (step === null) return this.reject(input.challenge, attempt, 'totp');
    if (!this.challenges.consume(input.challenge)) throw challengeExpired();

    const recoveryCodes = generateRecoveryCodes();
    const created = await this.enrollments.createIfAbsent({
      userId: user.id,
      sealedTotpSecret: this.config.sealSecret(user.id, challenge.secret),
      lastUsedStep: step,
      recoveryCodeHashes: this.hashRecoveryCodes(recoveryCodes),
      enabledAt: now,
    });
    if (!created) throw alreadyEnabled();

    await this.authSessions.revokeAllForUser(user.id);
    this.record(
      user,
      'mfa.enable',
      `${user.email} 계정이 2단계 인증을 켰습니다.`,
    );
    return {
      ...(await this.authSessions.signIn(user, client, 'mfa')),
      recoveryCodes,
    };
  }

  async status(account: { id: string; roles: string[] }): Promise<MfaStatus> {
    const enrollment = await this.enrollments.find(account.id);
    return {
      enabled: Boolean(enrollment),
      enabledAt: enrollment?.enabledAt.toISOString() ?? null,
      recoveryCodesRemaining: enrollment?.recoveryCodeHashes.length ?? 0,
      required: this.config.requiresMfa(account.roles),
    };
  }

  async regenerateRecoveryCodes(
    account: Account,
    code: string,
    client: SessionClient,
  ): Promise<{ recoveryCodes: string[] }> {
    const enrollment = await this.enrollments.find(account.id);
    if (!enrollment) {
      throw mfaError(
        HttpStatus.CONFLICT,
        'MFA_NOT_ENABLED',
        '2단계 인증을 쓰고 있지 않습니다.',
      );
    }
    const attempt = await this.guard.admit(client.ip, account.email);
    if (!(await this.acceptTotp(enrollment, code, new Date()))) {
      await this.guard.failed(attempt, 'wrong-otp');
      throw invalidCodeKeepingSession();
    }

    const recoveryCodes = generateRecoveryCodes();
    await this.enrollments.replaceRecoveryCodes(
      account.id,
      this.hashRecoveryCodes(recoveryCodes),
    );
    this.record(
      account,
      'mfa.recovery-codes.regenerate',
      `${account.email} 계정이 복구 코드를 새로 만들었습니다.`,
    );
    return { recoveryCodes };
  }

  private beginEnrollment(account: Account): {
    challenge: MfaChallengeToken;
    enrollment: MfaEnrollmentSetup;
  } {
    const secret = generateTotpSecret();
    return {
      challenge: this.challenges.issue({
        purpose: 'enroll',
        userId: account.id,
        secret,
      }),
      enrollment: {
        secret,
        otpauthUri: otpauthUri({
          issuer: this.config.issuer,
          account: account.email,
          secret,
        }),
      },
    };
  }

  private async acceptTotp(
    enrollment: UserMfa,
    code: string,
    now: Date,
  ): Promise<boolean> {
    const step = matchTotp(
      this.config.openSecret(enrollment.userId, enrollment.sealedTotpSecret),
      code,
      now,
      enrollment.lastUsedStep,
    );
    return (
      step !== null &&
      (await this.enrollments.claimTotpStep(enrollment.userId, step))
    );
  }

  private async acceptRecoveryCode(
    userId: string,
    code: string,
  ): Promise<boolean> {
    const normalized = normalizeRecoveryCode(code);
    return (
      normalized !== null &&
      (await this.enrollments.consumeRecoveryCode(
        userId,
        this.config.hashRecoveryCode(normalized),
      ))
    );
  }

  private async reject(
    token: string,
    attempt: unknown,
    method: MfaMethod,
  ): Promise<never> {
    const remaining = this.challenges.fail(token);
    await this.guard.failed(
      attempt,
      method === 'totp' ? 'wrong-otp' : 'wrong-recovery-code',
    );
    if (remaining === 0) {
      throw mfaError(
        HttpStatus.UNAUTHORIZED,
        'MFA_CHALLENGE_EXPIRED',
        '코드가 여러 번 틀렸습니다. 처음부터 다시 로그인해주세요.',
      );
    }
    throw mfaError(
      HttpStatus.UNAUTHORIZED,
      'MFA_CODE_INVALID',
      method === 'totp'
        ? '인증 코드가 맞지 않습니다.'
        : '복구 코드가 맞지 않거나 이미 쓴 코드입니다.',
      { remainingAttempts: remaining },
    );
  }

  private hashRecoveryCodes(codes: string[]): string[] {
    return codes.map((code) =>
      this.config.hashRecoveryCode(normalizeRecoveryCode(code)!),
    );
  }

  private record(account: Account, action: string, summary: string) {
    void this.audit
      .record({
        domain: 'security',
        action,
        summary,
        actorId: account.id,
        actorEmail: account.email,
        targetType: 'user',
        targetId: account.id,
      })
      .catch((error: Error) =>
        this.logger.error(`2단계 인증 감사 기록 실패: ${error.message}`),
      );
  }
}
