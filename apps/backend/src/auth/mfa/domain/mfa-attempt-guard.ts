export const MFA_ATTEMPT_GUARD = Symbol('MFA_ATTEMPT_GUARD');

export type MfaFailureReason =
  'wrong-otp' | 'wrong-recovery-code' | 'wrong-password';

/** 요청을 보낸 주소. ipVerified 는 프록시 비밀값으로 그 주소를 확인했는지다. */
export interface MfaClient {
  ip: string | null;
  ipVerified: boolean;
}

/**
 * 2단계 코드와 다시 받는 비밀번호를 로그인 실패와 같은 기준으로 센다. 로그인 차단이 이 자리를 채운다.
 * 막힌 IP·계정이면 확인하기 전에 429 를 던지고, 틀리면 실패로 남긴 뒤 null 을 돌려준다.
 */
export interface MfaAttemptGuard {
  check<U extends { id: string; email: string }>(
    client: MfaClient,
    email: string,
    verify: () => Promise<{ user: U } | { failure: MfaFailureReason }>,
  ): Promise<U | null>;
}
