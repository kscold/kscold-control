export const MFA_ATTEMPT_GUARD = Symbol('MFA_ATTEMPT_GUARD');

export type MfaFailureReason =
  'wrong-otp' | 'wrong-recovery-code' | 'wrong-password';

/** 틀린 2단계 코드를 로그인 실패와 같은 기준으로 세는 자리. 로그인 차단이 이 자리를 채운다. */
export interface MfaAttemptGuard<Attempt = unknown> {
  /**
   * 코드를 확인하기 전에 await 없이 부른다. 시도를 바로 한 번으로 세고, 막힌 계정이면 429 를 던진다.
   * 동시에 보낸 요청이 결과를 기다리는 사이 한도를 넘지 못하게 하려는 것이다.
   */
  admit(userId: string, ip: string | null): Attempt;
  /** 맞는 코드였으면 미리 센 시도를 되돌린다. */
  succeeded(attempt: Attempt): void;
  failed(attempt: Attempt, reason: MfaFailureReason, email: string): void;
}
