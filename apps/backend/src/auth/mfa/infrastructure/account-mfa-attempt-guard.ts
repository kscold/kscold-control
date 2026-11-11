import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AuditLogService } from '../../../audit/application/services/audit-log.service';
import type {
  MfaAttemptGuard,
  MfaFailureReason,
} from '../domain/mfa-attempt-guard';

interface MfaAttempt {
  ip: string | null;
  account: string;
}

const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_WINDOW = 10;

const REASON_LABEL: Record<MfaFailureReason, string> = {
  'wrong-otp': 'OTP 불일치',
  'wrong-recovery-code': '복구 코드 불일치',
};

/**
 * 비밀번호를 아는 쪽이 challenge 를 계속 새로 받아 코드를 대입하지 못하게 계정마다 실패를 센다.
 * 로그인 차단이 이 자리를 채우면 IP 단위 차단과 감사 기록까지 그쪽 기준을 따른다.
 */
@Injectable()
export class AccountMfaAttemptGuard implements MfaAttemptGuard<MfaAttempt> {
  private readonly logger = new Logger(AccountMfaAttemptGuard.name);
  private readonly failures = new Map<string, number[]>();

  constructor(private readonly audit: AuditLogService) {}

  async admit(ip: string | null, email: string): Promise<MfaAttempt> {
    const account = email.trim().toLowerCase();
    if (this.recentFailures(account).length >= MAX_FAILURES_PER_WINDOW) {
      throw new HttpException(
        '2단계 인증 코드를 여러 번 틀렸습니다. 15분 뒤 다시 시도해 주세요.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return { ip, account };
  }

  async failed(attempt: MfaAttempt, reason: MfaFailureReason): Promise<void> {
    this.failures.set(attempt.account, [
      ...this.recentFailures(attempt.account),
      Date.now(),
    ]);
    void this.audit
      .record({
        domain: 'security',
        action: 'login.mfa-failure',
        summary: `${attempt.account} 2단계 인증 실패 (IP ${attempt.ip ?? '알 수 없음'}, ${REASON_LABEL[reason]})`,
        targetType: 'account',
        targetId: attempt.account,
        metadata: { ip: attempt.ip, reason },
      })
      .catch((error: Error) =>
        this.logger.error(`2단계 인증 감사 기록 실패: ${error.message}`),
      );
  }

  private recentFailures(account: string): number[] {
    const since = Date.now() - FAILURE_WINDOW_MS;
    return (this.failures.get(account) ?? []).filter((at) => at > since);
  }
}
