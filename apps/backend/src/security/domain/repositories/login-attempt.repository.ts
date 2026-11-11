import type {
  LoginAttemptReason,
  LoginAttemptRecord,
} from '../login-guard/login-block.policy';

export const LOGIN_ATTEMPT_REPOSITORY = Symbol('LOGIN_ATTEMPT_REPOSITORY');

export interface ILoginAttemptRepository {
  append(
    attempt: LoginAttemptRecord & { reason: LoginAttemptReason | null },
  ): Promise<void>;
  /** 이 IP(주어졌을 때)나 이 계정에 걸린 기록. 둘 다에 걸린 행도 한 번만 돌려준다. */
  recent(query: {
    ip: string | null;
    ipSince: Date;
    account: string;
    accountSince: Date;
  }): Promise<LoginAttemptRecord[]>;
  deleteBefore(cutoff: Date): Promise<number>;
}
