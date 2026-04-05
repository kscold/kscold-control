import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useSystemInfo } from '../hooks/useSystemInfo';
import { useLiveStats } from '../hooks/useLiveStats';
import { useDashboardContainers } from '../hooks/useDashboardContainers';
import { formatUptime } from '../lib/dashboard.utils';
import { DashboardOverviewSkeleton } from './DashboardOverviewSkeleton';
import { SystemStatsCard } from './SystemStatsCard';
import { QuickActions } from './QuickActions';

export function DashboardOverview() {
  const { systemInfo, loadSystemInfo, loading, error, lastLoadedAt } =
    useSystemInfo();
  const { liveStats, loading: liveStatsLoading } = useLiveStats();
  const { containers, runningCount, loading: containersLoading } =
    useDashboardContainers();

  useEffect(() => {
    loadSystemInfo();
  }, [loadSystemInfo]);

  const showSkeleton =
    !error &&
    ((loading && !systemInfo) ||
      (liveStatsLoading && !liveStats) ||
      (containersLoading && containers.length === 0));

  if (showSkeleton) {
    return <DashboardOverviewSkeleton />;
  }

  return (
    <div className="h-full overflow-auto p-4 sm:p-6 bg-gray-950">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Dashboard</h2>
        <div className="flex items-center gap-3">
          {lastLoadedAt ? (
            <span className="text-xs text-gray-500">
              수집 {new Date(lastLoadedAt).toLocaleTimeString('ko-KR')}
            </span>
          ) : null}
          {liveStats && (
            <span className="text-xs text-gray-500">
              Uptime {formatUptime(liveStats.uptime)}
            </span>
          )}
          <button
            type="button"
            onClick={loadSystemInfo}
            disabled={loading}
            className="rounded-lg border border-gray-700 px-3 py-2 text-gray-300 transition hover:text-white disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {/* 통계 카드 */}
      <SystemStatsCard
        containers={containers}
        runningCount={runningCount}
        systemInfo={systemInfo}
        liveStats={liveStats}
      />

      {/* 빠른 액션 */}
      <QuickActions />
    </div>
  );
}
