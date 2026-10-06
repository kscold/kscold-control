/**
 * 백업 예약 규칙
 *
 * 대상마다 "매일 HH:mm" 한 번 실행한다. 스케줄러는 1분마다 깨어나
 * 예약 시각이 지났는데 아직 실행하지 않은 대상을 찾는다.
 * 정각에만 실행하는 방식과 달리, 그 시각에 서버가 내려가 있었더라도
 * 다시 올라온 뒤 한 번은 실행된다.
 */

/** 예약 시각을 해석하는 시간대 */
export const BACKUP_SCHEDULE_TIME_ZONE = 'Asia/Seoul';

/** 한국은 서머타임이 없어 UTC+9 고정으로 계산한다. */
const SCHEDULE_UTC_OFFSET_MS = 9 * 60 * 60 * 1000;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/** 실행 시각을 지정하지 않은 대상의 기본값. SSL 자동 갱신(04:10)과 겹치지 않게 잡았다. */
export const DEFAULT_BACKUP_SCHEDULE_TIME = '03:30';

/** 실행 시각 형식 (`HH:mm`, 00:00 ~ 23:59) */
export const BACKUP_SCHEDULE_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidBackupScheduleTime(value: string): boolean {
  return BACKUP_SCHEDULE_TIME_PATTERN.test(value);
}

/** 예약 실행 여부를 판단하는 데 필요한 대상의 상태 */
export interface BackupScheduleState {
  enabled: boolean;
  scheduleTime: string;
  scheduleCursorAt: Date;
}

/** `now` 를 기준으로 가장 최근에 지나간 예약 시각을 구한다. */
export function latestScheduledOccurrence(
  scheduleTime: string,
  now: Date,
): Date {
  const match = BACKUP_SCHEDULE_TIME_PATTERN.exec(scheduleTime);
  if (!match) {
    throw new Error(`예약 시각 형식이 올바르지 않습니다: ${scheduleTime}`);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);

  // 시간대 기준의 "오늘" 날짜를 얻으려고 오프셋만큼 민 시각의 UTC 필드를 읽는다.
  const local = new Date(now.getTime() + SCHEDULE_UTC_OFFSET_MS);
  const today =
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate(),
      hour,
      minute,
    ) - SCHEDULE_UTC_OFFSET_MS;

  return new Date(today <= now.getTime() ? today : today - DAY_IN_MS);
}

/**
 * 예약 실행 차례인지 판단한다.
 *
 * 가장 최근 예약 시각이 기준 시각(scheduleCursorAt)보다 뒤일 때만 차례다.
 * 기준 시각은 예약 실행을 시작할 때와 일정·사용 여부를 바꿀 때 현재 시각으로 옮기므로,
 * 같은 예약 시각이 두 번 실행되거나 대상을 등록하자마자 실행되는 일이 없다.
 */
export function isScheduledBackupDue(
  state: BackupScheduleState,
  now: Date,
): boolean {
  if (!state.enabled) {
    return false;
  }
  return (
    latestScheduledOccurrence(state.scheduleTime, now).getTime() >
    state.scheduleCursorAt.getTime()
  );
}

/**
 * 다음 예약 실행 시각을 구한다. 사용하지 않는 대상은 null 이다.
 * 이미 차례가 돌아와 곧 실행될 대상은 지나간 그 예약 시각을 돌려준다.
 */
export function resolveNextRunAt(
  state: BackupScheduleState,
  now: Date,
): Date | null {
  if (!state.enabled) {
    return null;
  }
  const latest = latestScheduledOccurrence(state.scheduleTime, now);
  return latest.getTime() > state.scheduleCursorAt.getTime()
    ? latest
    : new Date(latest.getTime() + DAY_IN_MS);
}
