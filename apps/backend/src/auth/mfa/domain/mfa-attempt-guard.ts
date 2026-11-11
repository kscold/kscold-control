export const MFA_ATTEMPT_GUARD = Symbol('MFA_ATTEMPT_GUARD');

export type MfaFailureReason = 'wrong-otp' | 'wrong-recovery-code';

/** 틀린 2단계 코드를 로그인 실패와 같은 기준으로 세는 자리. 로그인 차단이 이 자리를 채운다. */
export interface MfaAttemptGuard<Attempt = unknown> {
  /** 코드를 확인하기 전에 부른다. 막힌 IP·계정이면 예외(429)를 던져 코드를 보지 않게 한다. */
  admit(ip: string | null, email: string): Promise<Attempt>;
  failed(attempt: Attempt, reason: MfaFailureReason): Promise<void>;
}
