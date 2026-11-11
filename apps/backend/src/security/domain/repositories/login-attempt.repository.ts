import type {
  LoginAttemptRecord,
  LoginOrigin,
} from '../login-guard/login-block.policy';

export const LOGIN_ATTEMPT_REPOSITORY = Symbol('LOGIN_ATTEMPT_REPOSITORY');

export interface ILoginAttemptRepository {
  append(attempt: LoginAttemptRecord): Promise<void>;
  /**
   * 이 IP 대역(주어졌을 때)의 실패·거절과, 이 출처에서 이 계정이 틀린 기록. 둘 다에 걸린 행도 한 번만 돌려준다.
   * 계정 쪽은 실패만 읽는다. 잠긴 계정에 쌓이는 거절까지 읽으면 두드릴수록 모든 로그인이 느려진다.
   */
  recent(query: {
    ipGroup: string | null;
    ipSince: Date;
    account: string;
    origin: LoginOrigin;
    accountSince: Date;
  }): Promise<LoginAttemptRecord[]>;
  /** since 이후 IP 별 실패·거절 횟수와 마지막 시각. IP 가 없는 행은 뺀다. */
  failuresByIp(
    since: Date,
  ): Promise<Array<{ ip: string; failures: number; lastAt: Date }>>;
  deleteBefore(cutoff: Date): Promise<number>;
}
