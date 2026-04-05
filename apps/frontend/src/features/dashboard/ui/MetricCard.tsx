import type { ReactNode } from 'react';

interface MetricCardProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  footer?: ReactNode;
  className?: string;
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
  className,
  progress,
}: MetricCardProps) {
  return (
    <div
      className={`rounded-xl border border-gray-800 bg-gray-900 p-4 sm:p-5 ${className ?? 'min-h-[176px]'}`}
    >
      <div className="flex items-center gap-2 sm:gap-3 mb-2">
        <div className="flex-shrink-0">{icon}</div>
        <span className="text-gray-400 text-xs sm:text-sm">{label}</span>
      </div>
      <div className="min-h-[48px]">{value}</div>
      {progress ? (
        <div className="mt-2 w-full bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${progress.colorClassName}`}
            style={{ width: `${Math.min(progress.value, 100)}%` }}
          />
        </div>
      ) : null}
      {footer ? <div className="mt-2 min-h-[20px]">{footer}</div> : null}
    </div>
  );
}
