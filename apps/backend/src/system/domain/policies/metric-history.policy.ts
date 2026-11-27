export interface MetricPoint {
  at: string;
  cpu: number;
  memory: number;
  disk: number | null;
}

export const METRIC_RETENTION_HOURS = 72;
export const MAX_HISTORY_HOURS = 72;
/** 휴대폰 그래프는 이 정도 점이면 충분하다 */
export const MAX_POINTS = 240;

export function clampHistoryHours(value: unknown): number {
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours <= 0) return 24;
  return Math.min(Math.ceil(hours), MAX_HISTORY_HOURS);
}

/** 오래된 것부터 받은 표본을 같은 길이 구간으로 묶어 평균을 낸다 */
export function downsample(
  samples: readonly {
    at: Date;
    cpu: number;
    memory: number;
    disk: number | null;
  }[],
  maxPoints = MAX_POINTS,
): MetricPoint[] {
  if (samples.length === 0) return [];
  const size = Math.max(1, Math.ceil(samples.length / maxPoints));
  const points: MetricPoint[] = [];
  for (let i = 0; i < samples.length; i += size) {
    const bucket = samples.slice(i, i + size);
    const avg = (pick: (s: (typeof bucket)[number]) => number) =>
      Math.round(
        (bucket.reduce((sum, s) => sum + pick(s), 0) / bucket.length) * 10,
      ) / 10;
    const disks = bucket.filter((s) => s.disk !== null);
    points.push({
      at: bucket[bucket.length - 1].at.toISOString(),
      cpu: avg((s) => s.cpu),
      memory: avg((s) => s.memory),
      disk: disks.length
        ? Math.round(
            (disks.reduce((sum, s) => sum + (s.disk as number), 0) /
              disks.length) *
              10,
          ) / 10
        : null,
    });
  }
  return points;
}
