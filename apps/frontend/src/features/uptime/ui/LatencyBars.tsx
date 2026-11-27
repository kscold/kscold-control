import type { ServiceMonitor } from '../model/uptime.types';

/** 최근 검사를 막대로: 높이는 응답 시간, 빨강은 실패 */
export function LatencyBars({ recent }: { recent: ServiceMonitor['recent'] }) {
  const max = Math.max(1, ...recent.map((point) => point.latencyMs ?? 0));
  return (
    <div className="flex h-8 items-end gap-px" aria-hidden="true">
      {recent.map((point) => (
        <span
          key={point.at}
          title={`${new Date(point.at).toLocaleTimeString('ko-KR')} ${
            point.ok ? `${point.latencyMs}ms` : '실패'
          }`}
          className={`min-w-[3px] flex-1 rounded-sm ${point.ok ? 'bg-emerald-500/70' : 'bg-red-500'}`}
          style={{
            height: point.ok
              ? `${Math.max(12, ((point.latencyMs ?? 0) / max) * 100)}%`
              : '100%',
          }}
        />
      ))}
    </div>
  );
}
