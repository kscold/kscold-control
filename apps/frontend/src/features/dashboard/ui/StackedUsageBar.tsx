import { formatBytes } from '../lib/dashboard.utils';

interface StackedUsageBarSegment {
  label: string;
  value: number;
  colorClassName: string;
}

interface StackedUsageBarProps {
  total: number;
  segments: StackedUsageBarSegment[];
}

/**
 * 사용량을 범주별 스택 바로 보여줍니다.
 * 각 구간은 실제 비율을 반영하되, 너무 작은 값도 식별할 수 있게 최소 너비를 둡니다.
 */
export function StackedUsageBar({
  total,
  segments,
}: StackedUsageBarProps) {
  const safeTotal = Math.max(total, 1);
  const visibleSegments = segments.filter((segment) => segment.value > 0);

  return (
    <div className="overflow-hidden rounded-full border border-white/5 bg-gray-950/80 p-[2px]">
      <div className="flex h-3 w-full gap-[2px] rounded-full bg-gray-950/80">
        {visibleSegments.map((segment) => {
          const width = (segment.value / safeTotal) * 100;

          return (
            <div
              key={segment.label}
              data-testid="disk-usage-segment"
              className={`h-full rounded-full ${segment.colorClassName} transition-[width] duration-500`}
              style={{ width: `${Math.max(width, width > 0 ? 3 : 0)}%` }}
              title={`${segment.label} ${formatBytes(segment.value)}`}
            />
          );
        })}
      </div>
    </div>
  );
}
