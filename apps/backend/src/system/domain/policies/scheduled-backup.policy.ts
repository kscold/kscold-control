/** 예약 백업을 실행하는 시각 (매일 03:30). SSL 자동 갱신(04:10)과 겹치지 않게 잡았다. */
export const SCHEDULED_BACKUP_CRON = '30 3 * * *';

/** 예약 백업 시각을 해석하는 시간대 */
export const SCHEDULED_BACKUP_TIME_ZONE = 'Asia/Seoul';

/** 보관 기간을 지정하지 않은 예약 백업 대상에 적용하는 기본 보관 일수 */
export const DEFAULT_BACKUP_RETENTION_DAYS = 10;

/** 예약 백업 대상 이름 형식. 디렉터리·컨테이너 이름에 그대로 쓰이므로 범위를 좁게 잡는다. */
const TARGET_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

export function isValidScheduledBackupTargetName(name: string): boolean {
  return TARGET_NAME_PATTERN.test(name);
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/** 백업 디렉터리 이름 형식 (UTC 기준 `YYYY-MM-DD_HH-mm-ss`) */
const BACKUP_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})$/;

/** 백업 시각을 디렉터리 이름으로 쓸 수 있는 문자열로 바꾼다. */
export function formatBackupTimestamp(date: Date): string {
  return date.toISOString().replace('T', '_').replace(/:/g, '-').slice(0, 19);
}

/** 백업 디렉터리 이름에서 백업 시각을 읽는다. 형식이 다르면 null 을 돌려준다. */
export function parseBackupTimestamp(name: string): Date | null {
  const match = BACKUP_TIMESTAMP_PATTERN.exec(name);
  if (!match) {
    return null;
  }

  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  // 02-31 처럼 달력에 없는 값은 Date 가 다음 달로 넘겨 계산하므로 다시 비교해 걸러낸다.
  return formatBackupTimestamp(date) === name ? date : null;
}

/**
 * 보관 기간이 지나 지워도 되는 백업 이름을 고른다.
 *
 * - 이름이 백업 시각 형식이 아닌 항목은 이 기능이 만든 것이 아닐 수 있으므로 건드리지 않는다.
 * - 가장 최근 백업은 보관 기간이 지났더라도 남긴다. 백업이 한동안 실패했을 때
 *   마지막으로 성공한 사본까지 지워지는 일을 막기 위함이다.
 */
export function selectExpiredBackups(
  names: string[],
  retentionDays: number,
  now: Date,
): string[] {
  const backups = names
    .map((name) => ({ name, takenAt: parseBackupTimestamp(name) }))
    .filter(
      (backup): backup is { name: string; takenAt: Date } =>
        backup.takenAt !== null,
    )
    .sort((left, right) => right.takenAt.getTime() - left.takenAt.getTime());

  const cutoff = now.getTime() - retentionDays * DAY_IN_MS;

  return backups
    .slice(1)
    .filter((backup) => backup.takenAt.getTime() < cutoff)
    .map((backup) => backup.name);
}
