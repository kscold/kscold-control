import type { LoginAttemptRecord } from '../login-guard/login-block.policy';

export const LOGIN_ATTEMPT_REPOSITORY = Symbol('LOGIN_ATTEMPT_REPOSITORY');

export interface ILoginAttemptRepository {
  append(attempt: LoginAttemptRecord): Promise<void>;
  /** 이 IP 대역(주어졌을 때)이나 이 계정에 걸린 기록. 둘 다에 걸린 행도 한 번만 돌려준다. */
  recent(query: {
    ipGroup: string | null;
    ipSince: Date;
    account: string;
    accountSince: Date;
  }): Promise<LoginAttemptRecord[]>;
  deleteBefore(cutoff: Date): Promise<number>;
}
