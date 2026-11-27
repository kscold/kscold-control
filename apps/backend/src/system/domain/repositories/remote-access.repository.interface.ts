import type { RemoteAccessPath } from '../types/remote-access.type';

export interface IRemoteAccessRepository {
  /** 설정되지 않은 길은 빼고 돌려준다 */
  probe(): Promise<RemoteAccessPath[]>;
}

export const REMOTE_ACCESS_REPOSITORY = Symbol('REMOTE_ACCESS_REPOSITORY');
