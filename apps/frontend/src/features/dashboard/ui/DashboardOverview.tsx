import { useEffect } from 'react';
import { useSystemInfo } from '../hooks/useSystemInfo';
import { useLiveStats } from '../hooks/useLiveStats';
import { useDashboardContainers } from '../hooks/useDashboardContainers';
import { formatUptime } from '../lib/dashboard.utils';
import { SystemStatsCard } from './SystemStatsCard';
import { QuickActions } from './QuickActions';

export function DashboardOverview() {
  const { systemInfo, loadSystemInfo } = useSystemInfo();
  const { liveStats } = useLiveStats();
  const { containers, runningCount } = useDashboardContainers();

  useEffect(() => {
    loadSystemInfo();
  }, [loadSystemInfo]);

  return (
    <div className="h-full overflow-auto p-4 sm:p-6 bg-gray-950">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Dashboard</h2>
        {liveStats && (
          <span className="text-xs text-gray-500">
            Uptime {formatUptime(liveStats.uptime)}
          </span>
        )}
      </div>

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
