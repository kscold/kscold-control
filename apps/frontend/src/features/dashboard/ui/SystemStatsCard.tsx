import { Container, Cpu, Activity } from 'lucide-react';
import type { ContainerInfo, LiveStats, SystemInfo } from '../lib/dashboard.types';
import { formatBytes } from '../lib/dashboard.utils';
import { DiskUsageCard } from './DiskUsageCard';
import { MetricCard } from './MetricCard';
import { DockerStorageDetailsCard } from './DockerStorageDetailsCard';

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
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-5">
        <MetricCard
          icon={<Container size={18} className="text-blue-400" />}
          label="Containers"
          value={<p className="text-2xl sm:text-3xl font-bold text-white">{containers.length}</p>}
          footer={<p className="text-xs text-green-400">{runningCount} running</p>}
        />
        <MetricCard
          icon={<Cpu size={18} className="text-purple-400" />}
          label="CPU"
          value={<p className="text-2xl sm:text-3xl font-bold text-white">{cpuUsage.toFixed(1)}%</p>}
          footer={
            <p className="text-xs text-gray-500">
              {systemInfo ? `${systemInfo.cpu.count} cores` : '...'}
            </p>
          }
          progress={{
            value: cpuUsage,
            colorClassName:
              cpuUsage > 80 ? 'bg-red-500' : cpuUsage > 50 ? 'bg-amber-400' : 'bg-green-400',
          }}
        />
        <MetricCard
          icon={<Activity size={18} className="text-cyan-400" />}
          label="Memory"
          value={<p className="text-2xl sm:text-3xl font-bold text-white">{memUsage.toFixed(1)}%</p>}
          footer={
            <p className="text-xs text-gray-500">
              {liveStats
                ? `${formatBytes(liveStats.memory.used)} / ${formatBytes(liveStats.memory.total)}`
                : '...'}
            </p>
          }
          progress={{
            value: memUsage,
            colorClassName:
              memUsage > 80 ? 'bg-red-500' : memUsage > 60 ? 'bg-amber-400' : 'bg-blue-400',
          }}
        />
        <DiskUsageCard systemInfo={systemInfo} />
      </div>
      <DockerStorageDetailsCard systemInfo={systemInfo} />
    </>
  );
}
