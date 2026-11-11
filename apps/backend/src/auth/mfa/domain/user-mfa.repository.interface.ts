import type { UserMfa } from './user-mfa.entity';

export const USER_MFA_REPOSITORY = Symbol('USER_MFA_REPOSITORY');

/** 동시에 들어온 요청 중 하나만 통과하도록 쓰기는 모두 조건부 한 문장으로 끝낸다. */
export interface IUserMfaRepository {
  find(userId: string): Promise<UserMfa | null>;
  /** 이미 등록된 계정이면 아무것도 바꾸지 않고 false */
  create(enrollment: UserMfa): Promise<boolean>;
  /** step 이 마지막으로 쓴 step 보다 클 때만 기록하고 true */
  claimTotpStep(userId: string, step: number): Promise<boolean>;
  /** 남아 있던 복구 코드면 지우고 true */
  consumeRecoveryCode(userId: string, codeHash: string): Promise<boolean>;
  replaceRecoveryCodes(userId: string, codeHashes: string[]): Promise<void>;
}
