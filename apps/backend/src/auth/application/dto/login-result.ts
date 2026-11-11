export interface SignedInUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export interface AuthenticatedLogin {
  kind: 'authenticated';
  accessToken: string;
  user: SignedInUser;
}

export interface MfaChallengeToken {
  token: string;
  expiresAt: string;
}

export interface MfaEnrollmentSetup {
  /** 인증 앱에 손으로 넣을 base32 키 */
  secret: string;
  otpauthUri: string;
}

/** 비밀번호를 맞힌 뒤의 결과. 2단계가 남았으면 세션 대신 challenge 만 받는다. */
export type LoginResult =
  | AuthenticatedLogin
  | { kind: 'mfa_required'; challenge: MfaChallengeToken }
  | {
      kind: 'mfa_enrollment_required';
      challenge: MfaChallengeToken;
      enrollment: MfaEnrollmentSetup;
    };
