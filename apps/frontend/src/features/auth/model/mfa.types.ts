import type {
  AuthenticatedLogin,
  MfaChallengeToken,
  MfaEnrollmentSetup,
} from '@/shared/model';

export interface MfaStatus {
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodesRemaining: number;
  required: boolean;
}

export type MfaMethod = 'totp' | 'recovery';

export interface MfaEnrollmentStart {
  challenge: MfaChallengeToken;
  enrollment: MfaEnrollmentSetup;
}

export type EnrolledLogin = AuthenticatedLogin & { recoveryCodes: string[] };

export const RECOVERY_CODE_COUNT = 10;
