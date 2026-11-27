import { Link } from 'react-router-dom';
import { Activity, ChevronRight } from 'lucide-react';
import { useServiceMonitors } from '../model/useServiceMonitors';

/** 대시보드용 한 줄 요약: 끊긴 곳이 있으면 이름까지 빨갛게 */
export function UptimeSummaryCard() {
  const { monitors, error } = useServiceMonitors();
  if (error || !monitors || monitors.length === 0) return null;
  const down = monitors.filter((monitor) => monitor.state === 'down');
  return (
    <Link
      to="/uptime"
      className={`mb-4 flex items-center gap-3 rounded-xl border p-3 sm:mb-5 sm:p-4 ${
        down.length
          ? 'border-red-500/40 bg-red-950/30'
          : 'border-gray-800 bg-gray-900'
      }`}
    >
      <Activity
        size={18}
        className={down.length ? 'text-red-300' : 'text-emerald-400'}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">서비스 감시</p>
        <p
          className={`truncate text-xs ${down.length ? 'text-red-300' : 'text-gray-400'}`}
        >
          {down.length
            ? `끊김: ${down.map((monitor) => monitor.name).join(', ')}`
            : `${monitors.length}곳 모두 정상`}
        </p>
      </div>
      <ChevronRight size={16} className="shrink-0 text-gray-500" />
    </Link>
  );
}
