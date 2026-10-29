import type {
  AutomationHealth,
  LaunchdJobInfo,
  LaunchdSchedule,
  ReleaseDirConfig,
  ReleaseDirInfo,
} from '../types/automation.type';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MAX_MESSAGE_LENGTH = 200;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function describeInterval(seconds: number): string {
  if (seconds % 86400 === 0) {
    return seconds === 86400 ? '하루마다' : `${seconds / 86400}일마다`;
  }
  if (seconds % 3600 === 0) return `${seconds / 3600}시간마다`;
  if (seconds % 60 === 0) return `${seconds / 60}분마다`;
  return `${seconds}초마다`;
}

/** launchd 일정을 사람이 읽는 문장으로 바꾼다 */
export function describeLaunchdSchedule(schedule: LaunchdSchedule): string {
  const parts: string[] = [];
  for (const entry of schedule.calendar) {
    const time =
      entry.hour !== undefined
        ? `${pad(entry.hour)}:${pad(entry.minute ?? 0)}`
        : entry.minute !== undefined
          ? `매시 ${pad(entry.minute)}분`
          : null;
    if (!time) continue;
    const day =
      entry.weekday !== undefined
        ? `매주 ${WEEKDAYS[entry.weekday % 7]}요일`
        : '매일';
    parts.push(entry.hour !== undefined ? `${day} ${time}` : time);
  }
  if (schedule.intervalSeconds) {
    parts.push(describeInterval(schedule.intervalSeconds));
  }
  if (parts.length > 0) return parts.join(', ');
  if (schedule.launchOnlyOnce) return '로그인할 때 한 번';
  if (schedule.keepAlive) return '로그인하면 계속 실행';
  if (schedule.runAtLoad) return '로그인할 때 한 번';
  return '직접 실행할 때만';
}

/** `launchctl print` 출력에서 실행 상태와 마지막 종료 코드를 읽는다 */
export function parseLaunchctlPrint(output: string): {
  running: boolean;
  lastExitCode: number | null;
} {
  const state = /^\s*state = (.+)$/m.exec(output)?.[1]?.trim() ?? '';
  const exit = /^\s*last exit code = (-?\d+)/m.exec(output);
  return {
    running: state === 'running',
    lastExitCode: exit ? Number(exit[1]) : null,
  };
}

/**
 * launchd 작업의 상태를 고른다.
 * 계속 떠 있어야 하는 작업(KeepAlive)은 실행 중이어야 정상이고,
 * 정해진 때만 도는 작업은 마지막 종료 코드로 판단한다.
 */
export function launchdHealth(info: LaunchdJobInfo): AutomationHealth {
  const onlyAtLogin =
    info.schedule.calendar.length === 0 &&
    !info.schedule.intervalSeconds &&
    (info.schedule.launchOnlyOnce ||
      (info.schedule.runAtLoad && !info.schedule.keepAlive));
  // 로그인 때 한 번 도는 작업은 끝나면 목록에서 빠지므로 안 보인다고 멈춘 것은 아니다
  if (!info.loaded) return onlyAtLogin ? 'unknown' : 'stopped';
  if (info.schedule.launchOnlyOnce) {
    if (info.running) return 'running';
    if (info.lastExitCode === null) return 'unknown';
    return info.lastExitCode === 0 ? 'ok' : 'failed';
  }
  if (info.schedule.keepAlive && info.schedule.calendar.length === 0) {
    return info.running ? 'ok' : 'failed';
  }
  if (info.running) return 'running';
  if (info.lastExitCode === null) return 'unknown';
  return info.lastExitCode === 0 ? 'ok' : 'failed';
}

/** 기록 파일 끝에서 의미 있는 마지막 줄을 꺼낸다 (색상 코드 제거, 길이 제한) */
export function lastMeaningfulLine(text: string): string | null {
  const line = text
    // eslint-disable-next-line no-control-regex
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split('\n')
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && !/^[{}[\],]+$/.test(value))
    .at(-1);
  if (!line) return null;
  return line.length > MAX_MESSAGE_LENGTH
    ? `${line.slice(0, MAX_MESSAGE_LENGTH)}…`
    : line;
}

/** 릴리스 폴더가 정리 기준을 지키고 있는지 알려준다 */
export function summarizeReleaseDir(
  config: ReleaseDirConfig,
  info: ReleaseDirInfo,
  formatSize: (bytes: number) => string,
): { health: AutomationHealth; message: string } {
  const base = `지금 ${info.count}개 · ${formatSize(info.sizeBytes)} · 남기는 기준 ${config.keep}개`;
  return info.count <= config.keep
    ? { health: 'ok', message: base }
    : { health: 'unknown', message: `${base} (다음 배포가 성공하면 정리됨)` };
}
