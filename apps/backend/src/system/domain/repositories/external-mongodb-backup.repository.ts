import type { ScheduledBackupTarget } from '../types/scheduled-backup.type';
import type { MongodbBackupResult } from './mongodb-backup.repository';

/** 컨테이너 밖에 있는 MongoDB(Atlas 등)를 백업하고 정리하는 포트 */
export interface IExternalMongodbBackupRepository {
  /** 대상 MongoDB 를 덤프해 새 백업을 만든다. */
  create(target: ScheduledBackupTarget): Promise<MongodbBackupResult>;
  /** 보관 기간이 지난 백업을 지우고, 지운 백업 이름을 돌려준다. */
  prune(targetName: string, retentionDays: number): Promise<string[]>;
}

export const EXTERNAL_MONGODB_BACKUP_REPOSITORY = Symbol(
  'EXTERNAL_MONGODB_BACKUP_REPOSITORY',
);
