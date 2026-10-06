import type {
  BackupArchive,
  BackupArchiveResult,
  BackupDumpRequest,
} from '../types/backup.type';

/** 백업 아카이브를 만들고, 보관 중인 것을 조회·정리하는 포트 */
export interface IBackupArchiveRepository {
  /** 대상 데이터베이스를 덤프해 새 백업을 만든다. */
  create(request: BackupDumpRequest): Promise<BackupArchiveResult>;
  /** 보관 중인 백업을 최근 것부터 돌려준다. */
  list(targetName: string): Promise<BackupArchive[]>;
  /** 보관 기간이 지난 백업을 지우고, 지운 백업 이름을 돌려준다. */
  prune(targetName: string, retentionDays: number): Promise<string[]>;
}

export const BACKUP_ARCHIVE_REPOSITORY = Symbol('BACKUP_ARCHIVE_REPOSITORY');
