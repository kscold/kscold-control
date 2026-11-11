import type { UserMfa } from './user-mfa.entity';

export const USER_MFA_REPOSITORY = Symbol('USER_MFA_REPOSITORY');

export interface IUserMfaRepository {
  find(userId: string): Promise<UserMfa | null>;
  createIfAbsent(enrollment: UserMfa): Promise<boolean>;
  claimTotpStep(userId: string, step: number): Promise<boolean>;
  consumeRecoveryCode(userId: string, codeHash: string): Promise<boolean>;
  replaceRecoveryCodes(userId: string, codeHashes: string[]): Promise<void>;
}
