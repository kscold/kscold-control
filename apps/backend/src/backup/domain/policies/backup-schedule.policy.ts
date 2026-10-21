/**
 * 백업 예약 규칙
 *
 * 매일 정해진 시각에 한 번 실행하는 공통 규칙을 백업 용어로 내보낸다.
 */
export {
  DAILY_SCHEDULE_TIME_ZONE as BACKUP_SCHEDULE_TIME_ZONE,
  DAILY_SCHEDULE_TIME_PATTERN as BACKUP_SCHEDULE_TIME_PATTERN,
  isValidDailyScheduleTime as isValidBackupScheduleTime,
  isDailyScheduleDue as isScheduledBackupDue,
  latestScheduledOccurrence,
  resolveNextRunAt,
  type DailyScheduleState as BackupScheduleState,
} from '../../../common/scheduling/daily-schedule.policy';

/** 실행 시각을 지정하지 않은 대상의 기본값. SSL 자동 갱신(04:10)과 겹치지 않게 잡았다. */
export const DEFAULT_BACKUP_SCHEDULE_TIME = '03:30';
