import { useEffect, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { useSystemInfo } from '../model/useSystemInfo';
import { useLiveStats } from '../model/useLiveStats';
import { useDashboardContainers } from '../model/useDashboardContainers';
import { formatUptime } from '@/shared/lib';
import { DashboardOverviewSkeleton } from './DashboardOverviewSkeleton';
import { SystemStatsCard } from './SystemStatsCard';
import { QuickActions } from './QuickActions';
import { RemoteAccessCard } from './RemoteAccessCard';
import { MetricHistoryCard } from './MetricHistoryCard';

/** summary: 다른 기능이 맨 위에 끼워 넣는 요약 카드(서비스 감시 등) */
export function DashboardOverview({ summary }: { summary?: ReactNode } = {}) {
  const { systemInfo, loadSystemInfo, loading, error, lastLoadedAt } =
    useSystemInfo();
  const {
    liveStats,
    loading: liveStatsLoading,
    failed: liveStatsFailed,
  } = useLiveStats();
  const {
    containerSummary,
    loading: containersLoading,
    failed: containersFailed,
  } = useDashboardContainers();

  useEffect(() => {
    loadSystemInfo();
  }, [loadSystemInfo]);

  const showSkeleton =
    !error &&
    loading &&
    !systemInfo &&
    liveStatsLoading &&
    !liveStats &&
    containersLoading &&
    !containerSummary;

  if (showSkeleton) {
    return <DashboardOverviewSkeleton />;
  }

  return (
    <div className="h-full overflow-auto p-4 sm:p-6 bg-gray-950">
      {/* 휴대폰에서는 수집 시각·가동 시간을 제목 아래 줄로 내린다 */}
      <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 sm:mb-6">
        <h2 className="mr-auto text-xl font-bold text-white sm:text-2xl">
          Dashboard
        </h2>
        <div className="mr-auto flex flex-wrap gap-x-3 text-xs text-gray-500 md:mr-0">
          {lastLoadedAt ? (
            <span className="whitespace-nowrap">
              수집 {new Date(lastLoadedAt).toLocaleTimeString('ko-KR')}
            </span>
          ) : null}
          {liveStats && (
            <span className="whitespace-nowrap">
              Uptime {formatUptime(liveStats.uptime)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={loadSystemInfo}
          disabled={loading}
          aria-label="대시보드 새로고침"
          className="shrink-0 rounded-lg border border-gray-700 px-3 py-2 text-gray-300 transition hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {liveStatsFailed || containersFailed ? (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-2 text-xs text-amber-200">
          실시간 갱신에 실패했습니다. 아래 값은 마지막으로 받은 값일 수
          있습니다.
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {/* 해외에서 폰으로 볼 때 가장 먼저 확인할 것: 들어오는 길이 살아 있는지 */}
      {summary}
      <RemoteAccessCard />

      {/* 통계 카드 */}
      <SystemStatsCard
        containerCount={containerSummary?.total ?? null}
        runningCount={containerSummary?.running ?? null}
        systemInfo={systemInfo}
        liveStats={liveStats}
      />

      <MetricHistoryCard />

      {/* 빠른 액션 */}
      <QuickActions />
    </div>
  );
}
