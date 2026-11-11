import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AuditLogService } from '../../../audit/application/services/audit-log.service';
import type { CreateAuditEventInput } from '../../../audit/domain/types/audit-event.type';
import type {
  MfaAttemptGuard,
  MfaFailureReason,
} from '../domain/mfa-attempt-guard';

interface MfaAttempt {
  userId: string;
  ip: string | null;
  at: number;
}

interface AccountWindow {
  attempts: number[];
  email: string | null;
  lockoutAuditedFor: number | null;
}

const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_WINDOW = 10;

const REASON_LABEL: Record<MfaFailureReason, string> = {
  'wrong-otp': 'OTP 불일치',
  'wrong-recovery-code': '복구 코드 불일치',
  'wrong-password': '비밀번호 불일치',
};

/**
 * 비밀번호를 아는 쪽이 challenge 를 계속 새로 받아 코드를 대입하지 못하게 계정마다 시도를 센다.
 * 로그인 차단이 이 자리를 채우면 IP 단위 차단과 감사 기록까지 그쪽 기준을 따른다.
 */
@Injectable()
export class AccountMfaAttemptGuard implements MfaAttemptGuard<MfaAttempt> {
  private readonly logger = new Logger(AccountMfaAttemptGuard.name);
  private readonly accounts = new Map<string, AccountWindow>();

  constructor(private readonly audit: AuditLogService) {}

  admit(userId: string, ip: string | null): MfaAttempt {
    const now = Date.now();
    const account = this.window(userId, now);
    if (account.attempts.length >= MAX_FAILURES_PER_WINDOW) {
      this.recordLockout(userId, ip, account);
      throw new HttpException(
        '2단계 인증 코드를 여러 번 틀렸습니다. 15분 뒤 다시 시도해 주세요.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    account.attempts.push(now);
    return { userId, ip, at: now };
  }

  succeeded(attempt: MfaAttempt): void {
    const attempts = this.accounts.get(attempt.userId)?.attempts;
    const index = attempts?.indexOf(attempt.at) ?? -1;
    if (index >= 0) attempts!.splice(index, 1);
  }

  failed(attempt: MfaAttempt, reason: MfaFailureReason, email: string): void {
    const account = this.window(attempt.userId, Date.now());
    account.email = email;
    this.record({
      action: 'login.mfa-failure',
      summary: `${email} 2단계 인증 실패 (IP ${attempt.ip ?? '알 수 없음'}, ${REASON_LABEL[reason]})`,
      targetType: 'user',
      targetId: attempt.userId,
      metadata: { ip: attempt.ip, reason, email },
    });
  }

  private window(userId: string, now: number): AccountWindow {
    const since = now - FAILURE_WINDOW_MS;
    const account = this.accounts.get(userId) ?? {
      attempts: [],
      email: null,
      lockoutAuditedFor: null,
    };
    account.attempts = account.attempts.filter((at) => at > since);
    this.accounts.set(userId, account);
    return account;
  }

  /** 잠긴 동안 들어오는 요청마다 남기면 기록이 넘치므로 잠김 하나에 한 번만 남긴다. */
  private recordLockout(
    userId: string,
    ip: string | null,
    account: AccountWindow,
  ) {
    const lockout = account.attempts[0];
    if (account.lockoutAuditedFor === lockout) return;
    account.lockoutAuditedFor = lockout;
    const who = account.email ?? userId;
    this.record({
      action: 'login.mfa-lockout',
      summary: `${who} 2단계 인증을 15분 동안 막았습니다 (IP ${ip ?? '알 수 없음'}, ${MAX_FAILURES_PER_WINDOW}번 시도)`,
      targetType: 'user',
      targetId: userId,
      metadata: { ip, email: account.email },
    });
  }

  private record(event: Omit<CreateAuditEventInput, 'domain'>) {
    void this.audit
      .record({ domain: 'security', ...event })
      .catch((error: Error) =>
        this.logger.error(`2단계 인증 감사 기록 실패: ${error.message}`),
      );
  }
}
