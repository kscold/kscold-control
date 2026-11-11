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
  secret: string;
  otpauthUri: string;
}

export type LoginResult =
  | AuthenticatedLogin
  | { kind: 'mfa_required'; challenge: MfaChallengeToken }
  | {
      kind: 'mfa_enrollment_required';
      challenge: MfaChallengeToken;
      enrollment: MfaEnrollmentSetup;
    };
