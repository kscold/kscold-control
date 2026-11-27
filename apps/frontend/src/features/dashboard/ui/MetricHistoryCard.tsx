import { useEffect, useState } from 'react';
import { LineChart } from 'lucide-react';
import { dashboardService } from '../api/dashboard.service';
import type { MetricPoint } from '../model/dashboard.types';

const RANGES = [6, 24, 72] as const;
const SERIES = [
  { key: 'cpu', label: 'CPU', color: '#a78bfa' },
  { key: 'memory', label: '메모리', color: '#38bdf8' },
  { key: 'disk', label: '디스크', color: '#fb923c' },
] as const;

/** 0~100% 선 그래프. 끊긴 구간(값 없음)은 선을 잇지 않는다 */
function path(points: MetricPoint[], key: 'cpu' | 'memory' | 'disk') {
  const last = Math.max(1, points.length - 1);
  let d = '';
  let pen = false;
  points.forEach((point, i) => {
    const value = point[key];
    if (value === null) {
      pen = false;
      return;
    }
    const x = (i / last) * 100;
    const y = 100 - Math.min(100, Math.max(0, value));
    d += `${pen ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)} `;
    pen = true;
  });
  return d;
}

export function MetricHistoryCard() {
  const [hours, setHours] = useState<number>(24);
  const [points, setPoints] = useState<MetricPoint[] | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      dashboardService
        .getHistory(hours)
        .then((data) => alive && setPoints(data))
        .catch(() => alive && setPoints([]));
    void load();
    const timer = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [hours]);

  const latest = points?.[points.length - 1];

  return (
    <section className="mb-4 rounded-xl border border-gray-800 bg-gray-900 p-3 sm:mb-5 sm:p-5">
      <div className="mb-2 flex items-center gap-2">
        <LineChart size={18} className="text-violet-300" />
        <h3 className="mr-auto text-sm font-semibold text-white">
          사용률 추이
        </h3>
        {RANGES.map((range) => (
          <button
            key={range}
            type="button"
            aria-pressed={hours === range}
            onClick={() => setHours(range)}
            className={`rounded-md px-2 py-1 text-xs ${
              hours === range ? 'bg-violet-600 text-white' : 'text-gray-400'
            }`}
          >
            {range}시간
          </button>
        ))}
      </div>
      <div className="mb-2 flex flex-wrap gap-x-3 text-xs">
        {SERIES.map((series) => (
          <span key={series.key} className="text-gray-400">
            <span
              className="mr-1 inline-block h-2 w-2 rounded-full"
              style={{ background: series.color }}
            />
            {series.label}
            {latest && latest[series.key] !== null
              ? ` ${latest[series.key]}%`
              : ''}
          </span>
        ))}
      </div>
      {points === null ? (
        <p className="py-8 text-center text-xs text-gray-500">불러오는 중…</p>
      ) : points.length < 2 ? (
        <p className="py-8 text-center text-xs text-gray-500">
          1분마다 기록합니다. 잠시 뒤 그래프가 나타납니다.
        </p>
      ) : (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="h-32 w-full sm:h-40"
          role="img"
          aria-label={`최근 ${hours}시간 CPU·메모리·디스크 사용률`}
        >
          {[25, 50, 75].map((y) => (
            <line
              key={y}
              x1="0"
              x2="100"
              y1={y}
              y2={y}
              stroke="#1f2937"
              strokeWidth="0.5"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {SERIES.map((series) => (
            <path
              key={series.key}
              d={path(points, series.key)}
              fill="none"
              stroke={series.color}
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      )}
    </section>
  );
}
