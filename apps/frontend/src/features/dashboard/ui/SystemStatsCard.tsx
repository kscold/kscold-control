import { Container, Cpu, HardDrive, Activity } from 'lucide-react';
import type { ContainerInfo, SystemInfo, LiveStats } from '../lib/dashboard.types';
import { formatBytes } from '../lib/dashboard.utils';

interface SystemStatsCardProps {
  containers: ContainerInfo[];
  runningCount: number;
  systemInfo: SystemInfo | null;
  liveStats: LiveStats | null;
}

export function SystemStatsCard({
  containers,
  runningCount,
  systemInfo,
  liveStats,
}: SystemStatsCardProps) {
  const cpuUsage = liveStats?.cpu.usage ?? 0;
  const memUsage = liveStats?.memory.usedPercent ?? 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
        <div className="flex items-center gap-2 sm:gap-3 mb-2">
          <Container size={18} className="text-blue-400 flex-shrink-0" />
          <span className="text-gray-400 text-xs sm:text-sm">Containers</span>
        </div>
        <p className="text-2xl sm:text-3xl font-bold text-white">
          {containers.length}
        </p>
        <p className="text-xs text-green-400 mt-1">
          {runningCount} running
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
        <div className="flex items-center gap-2 sm:gap-3 mb-2">
          <Cpu size={18} className="text-purple-400 flex-shrink-0" />
          <span className="text-gray-400 text-xs sm:text-sm">CPU</span>
        </div>
        <p className="text-2xl sm:text-3xl font-bold text-white">
          {cpuUsage.toFixed(1)}%
        </p>
        <div className="mt-2 w-full bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              cpuUsage > 80
                ? 'bg-red-500'
                : cpuUsage > 50
                  ? 'bg-amber-400'
                  : 'bg-green-400'
            }`}
            style={{ width: `${Math.min(cpuUsage, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {systemInfo ? `${systemInfo.cpu.count} cores` : '...'}
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
        <div className="flex items-center gap-2 sm:gap-3 mb-2">
          <Activity size={18} className="text-cyan-400 flex-shrink-0" />
          <span className="text-gray-400 text-xs sm:text-sm">Memory</span>
        </div>
        <p className="text-2xl sm:text-3xl font-bold text-white">
          {memUsage.toFixed(1)}%
        </p>
        <div className="mt-2 w-full bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              memUsage > 80
                ? 'bg-red-500'
                : memUsage > 60
                  ? 'bg-amber-400'
                  : 'bg-blue-400'
            }`}
            style={{ width: `${Math.min(memUsage, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {liveStats
            ? `${formatBytes(liveStats.memory.used)} / ${formatBytes(liveStats.memory.total)}`
            : '...'}
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5">
        <div className="flex items-center gap-2 sm:gap-3 mb-2">
          <HardDrive size={18} className="text-amber-400 flex-shrink-0" />
          <span className="text-gray-400 text-xs sm:text-sm">Disk</span>
        </div>
        {systemInfo ? (
          <div>
            <p className="text-lg sm:text-2xl font-bold text-white">
              {formatBytes(systemInfo.disk.used)} /{' '}
              {formatBytes(systemInfo.disk.total)}
            </p>
            <div className="mt-2 w-full bg-gray-700 rounded-full h-2 flex overflow-hidden">
              {systemInfo.disk.breakdown && (
                <>
                  <div
                    className="bg-blue-400 h-2 transition-all"
                    style={{
                      width: `${(systemInfo.disk.breakdown.docker / systemInfo.disk.total) * 100}%`,
                    }}
                  />
                  <div
                    className="bg-purple-400 h-2 transition-all"
                    style={{
                      width: `${(systemInfo.disk.breakdown.applications / systemInfo.disk.total) * 100}%`,
                    }}
                  />
                  <div
                    className="bg-amber-400 h-2 transition-all"
                    style={{
                      width: `${(systemInfo.disk.breakdown.other / systemInfo.disk.total) * 100}%`,
                    }}
                  />
                </>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {systemInfo.disk.usedPercent.toFixed(1)}% used
            </p>
            {systemInfo.disk.breakdown && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                  <span className="text-gray-400">
                    Docker {formatBytes(systemInfo.disk.breakdown.docker)}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
                  <span className="text-gray-400">
                    Apps {formatBytes(systemInfo.disk.breakdown.applications)}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  <span className="text-gray-400">
                    Other {formatBytes(systemInfo.disk.breakdown.other)}
                  </span>
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-2xl sm:text-3xl font-bold text-white">...</p>
        )}
      </div>
    </div>
  );
}
