import type { ReactNode } from 'react';

interface MetricCardProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  footer?: ReactNode;
  progress?: {
    value: number;
    colorClassName: string;
  };
}

export function MetricCard({
  icon,
  label,
  value,
  footer,
  progress,
}: MetricCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
      <div className="flex items-center gap-2 sm:gap-3 mb-2">
        <div className="flex-shrink-0">{icon}</div>
        <span className="text-gray-400 text-xs sm:text-sm">{label}</span>
      </div>
      <div>{value}</div>
      {progress ? (
        <div className="mt-2 w-full bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${progress.colorClassName}`}
            style={{ width: `${Math.min(progress.value, 100)}%` }}
          />
        </div>
      ) : null}
      {footer ? <div className="mt-1">{footer}</div> : null}
    </div>
  );
}
