export const MFA_ATTEMPT_GUARD = Symbol('MFA_ATTEMPT_GUARD');

export type MfaFailureReason = 'wrong-otp' | 'wrong-recovery-code';

/**
 * 2단계 코드 확인을 로그인 실패 판정에 넣는 자리.
 * 로그인 차단(LoginGuardService)이 들어오면 같은 모양의 `admit`·`failed` 로 이 자리를 채워
 * 틀린 OTP·복구 코드도 비밀번호 실패와 함께 센다.
 */
export interface MfaAttemptGuard<Attempt = unknown> {
  /** 코드를 확인하기 전에 부른다. 막힌 IP·계정이면 예외(429)를 던진다. */
  admit(ip: string | null, email: string): Promise<Attempt>;
  failed(attempt: Attempt, reason: MfaFailureReason): Promise<void>;
}
