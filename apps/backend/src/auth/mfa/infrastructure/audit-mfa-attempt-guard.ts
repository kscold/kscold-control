import { Injectable, Logger } from '@nestjs/common';
import { AuditLogService } from '../../../audit/application/services/audit-log.service';
import type {
  MfaAttemptGuard,
  MfaFailureReason,
} from '../domain/mfa-attempt-guard';

interface MfaAttempt {
  ip: string | null;
  email: string;
}

const REASON_LABEL: Record<MfaFailureReason, string> = {
  'wrong-otp': 'OTP 불일치',
  'wrong-recovery-code': '복구 코드 불일치',
};

/**
 * 로그인 차단이 붙기 전의 기본값. 막지는 않고 틀린 2단계 코드를 운영 감사에 남긴다.
 * 그동안은 challenge 하나에 다섯 번까지만 틀릴 수 있다는 제한이 무차별 대입을 늦춘다.
 */
@Injectable()
export class AuditMfaAttemptGuard implements MfaAttemptGuard<MfaAttempt> {
  private readonly logger = new Logger(AuditMfaAttemptGuard.name);

  constructor(private readonly audit: AuditLogService) {}

  async admit(ip: string | null, email: string): Promise<MfaAttempt> {
    return { ip, email };
  }

  async failed(attempt: MfaAttempt, reason: MfaFailureReason): Promise<void> {
    void this.audit
      .record({
        domain: 'security',
        action: 'login.mfa-failure',
        summary: `${attempt.email} 2단계 인증 실패 (IP ${attempt.ip ?? '알 수 없음'}, ${REASON_LABEL[reason]})`,
        targetType: 'account',
        targetId: attempt.email,
        metadata: { ip: attempt.ip, reason },
      })
      .catch((error: Error) =>
        this.logger.error(`2단계 인증 감사 기록 실패: ${error.message}`),
      );
  }
}
