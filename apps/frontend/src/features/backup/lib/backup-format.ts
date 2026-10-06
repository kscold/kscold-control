import type {
  BackupRun,
  BackupRunStatus,
  BackupTrigger,
} from '../model/backup.types';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** 실행에 걸린 시간을 "4초", "1분 12초" 처럼 보여준다. 아직 끝나지 않았으면 빈 문자열 */
export function formatRunDuration(
  startedAt: string,
  finishedAt: string | null,
): string {
  if (!finishedAt) return '';

  const elapsed = Date.parse(finishedAt) - Date.parse(startedAt);
  if (Number.isNaN(elapsed) || elapsed < 0) return '';
  if (elapsed < SECOND) return '1초 미만';

  const totalSeconds = Math.round(elapsed / SECOND);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}초`;
  return seconds === 0 ? `${minutes}분` : `${minutes}분 ${seconds}초`;
}

/** 기준 시각에서 얼마나 떨어졌는지 "3시간 뒤", "12분 전" 처럼 보여준다. */
export function formatRelativeTime(value: string, now: Date): string {
  const diff = Date.parse(value) - now.getTime();
  if (Number.isNaN(diff)) return '';

  const distance = Math.abs(diff);
  const suffix = diff >= 0 ? '뒤' : '전';
  if (distance < MINUTE) return diff >= 0 ? '곧' : '방금';
  if (distance < HOUR) return `${Math.round(distance / MINUTE)}분 ${suffix}`;
  if (distance < DAY) return `${Math.round(distance / HOUR)}시간 ${suffix}`;
  return `${Math.round(distance / DAY)}일 ${suffix}`;
}

export function getTriggerLabel(trigger: BackupTrigger): string {
  return trigger === 'schedule' ? '예약' : '수동';
}

const STATUS_PRESENTATION: Record<
  BackupRunStatus,
  { label: string; className: string }
> = {
  running: {
    label: '실행 중',
    className: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  },
  success: {
    label: '성공',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  },
  failed: {
    label: '실패',
    className: 'border-red-500/30 bg-red-500/10 text-red-200',
  },
};

export function getRunStatusPresentation(status: BackupRunStatus) {
  return STATUS_PRESENTATION[status];
}

/** 실행 기록에서 "누가/무엇이 실행했는지"를 한 줄로 만든다. */
export function describeRunOrigin(
  run: Pick<BackupRun, 'trigger' | 'actorEmail'>,
): string {
  const label = getTriggerLabel(run.trigger);
  return run.trigger === 'manual' && run.actorEmail
    ? `${label} · ${run.actorEmail}`
    : label;
}

/** 백업 아카이브를 되돌리는 명령. 복원할 곳의 접속 URI 는 실행하는 사람이 환경변수로 준다. */
export function buildRestoreCommand(
  archivePath: string,
  dumpImage: string,
): string {
  return [
    `docker run --rm -i -e MONGODB_URI ${dumpImage} \\`,
    `  sh -c 'mongorestore --uri "$MONGODB_URI" --archive --gzip' \\`,
    `  < "${archivePath}/dump.archive.gz"`,
  ].join('\n');
}
