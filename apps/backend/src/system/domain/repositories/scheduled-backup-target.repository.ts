import type { ScheduledBackupTarget } from '../types/scheduled-backup.type';

/** 예약 백업 대상 설정을 읽어 오는 포트 */
export interface IScheduledBackupTargetRepository {
  findAll(): ScheduledBackupTarget[];
}

export const SCHEDULED_BACKUP_TARGET_REPOSITORY = Symbol(
  'SCHEDULED_BACKUP_TARGET_REPOSITORY',
);
