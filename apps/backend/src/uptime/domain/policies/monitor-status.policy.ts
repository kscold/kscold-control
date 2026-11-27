export type MonitorState = 'unknown' | 'up' | 'down';

/** 한 번 실패로 바로 알리면 순간적인 끊김에도 알림이 온다. 연속 실패가 이만큼 쌓여야 down. */
export const FAILURES_BEFORE_DOWN = 2;
/** 검사 기록은 이 기간만 남긴다 */
export const CHECK_RETENTION_DAYS = 7;
export const MIN_INTERVAL_SECONDS = 30;
export const MAX_INTERVAL_SECONDS = 3600;

export interface CheckResult {
  ok: boolean;
  latencyMs: number | null;
}

/**
 * 최근 결과(새것부터)로 다음 상태를 정한다.
 * 성공 한 번이면 up, 연속 실패가 기준 이상이면 down, 그 사이면 이전 상태를 유지한다.
 */
export function nextMonitorState(
  previous: MonitorState,
  recentNewestFirst: readonly CheckResult[],
): MonitorState {
  const latest = recentNewestFirst[0];
  if (!latest) return previous;
  if (latest.ok) return 'up';
  const failures = recentNewestFirst.findIndex((check) => check.ok);
  const consecutive = failures === -1 ? recentNewestFirst.length : failures;
  return consecutive >= FAILURES_BEFORE_DOWN ? 'down' : previous;
}

/** 상태가 실제로 바뀌었을 때만 알린다 (처음 확인된 up 은 알리지 않음) */
export function shouldNotify(previous: MonitorState, next: MonitorState) {
  return previous !== next && !(previous === 'unknown' && next === 'up');
}

export function summarizeChecks(checks: readonly CheckResult[]): {
  uptimePercent: number | null;
  averageLatencyMs: number | null;
} {
  if (checks.length === 0)
    return { uptimePercent: null, averageLatencyMs: null };
  const ok = checks.filter((check) => check.ok);
  const latencies = ok
    .map((check) => check.latencyMs)
    .filter((value): value is number => value !== null);
  return {
    uptimePercent: Math.round((ok.length / checks.length) * 1000) / 10,
    averageLatencyMs: latencies.length
      ? Math.round(
          latencies.reduce((sum, value) => sum + value, 0) / latencies.length,
        )
      : null,
  };
}

/** http·https 만, 사용자 정보(아이디:비번@)는 받지 않는다 */
export function isMonitorUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
