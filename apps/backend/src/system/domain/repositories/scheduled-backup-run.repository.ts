import type { ScheduledBackupRun } from '../types/scheduled-backup.type';

/** 예약 백업의 마지막 실행 결과를 보관하는 포트 */
export interface IScheduledBackupRunRepository {
  findLatest(targetName: string): ScheduledBackupRun | null;
  save(run: ScheduledBackupRun): void;
}

export const SCHEDULED_BACKUP_RUN_REPOSITORY = Symbol(
  'SCHEDULED_BACKUP_RUN_REPOSITORY',
);
