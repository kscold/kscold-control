import { Container, Cpu, Activity } from 'lucide-react';
import {
  getCpuProgressTone,
  getMemoryProgressTone,
} from '../lib/dashboard.colors';
import type {
  ContainerInfo,
  LiveStats,
  SystemInfo,
} from '../lib/dashboard.types';
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
  const cpuTone = getCpuProgressTone(cpuUsage);
  const memoryTone = getMemoryProgressTone(memUsage);

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-5">
        <MetricCard
          icon={<Container size={18} className="text-blue-400" />}
          label="Containers"
          value={
            <p className="text-2xl sm:text-3xl font-bold text-white">
              {containers.length}
            </p>
          }
          footer={
            <p className="text-xs text-green-400">{runningCount} running</p>
          }
        />
        <MetricCard
          icon={<Cpu size={18} className={cpuTone.iconClassName} />}
          label="CPU"
          value={
            <p className="text-2xl sm:text-3xl font-bold text-white">
              {cpuUsage.toFixed(1)}%
            </p>
          }
          footer={
            <p className="text-xs text-gray-500">
              {systemInfo ? `${systemInfo.cpu.count} cores` : '...'}
            </p>
          }
          progress={{
            value: cpuUsage,
            colorClassName: cpuTone.barClassName,
          }}
        />
        <MetricCard
          icon={<Activity size={18} className={memoryTone.iconClassName} />}
          label="Memory"
          value={
            <p className="text-2xl sm:text-3xl font-bold text-white">
              {memUsage.toFixed(1)}%
            </p>
          }
          footer={
            <p className="text-xs text-gray-500">
              {liveStats
                ? `${formatBytes(liveStats.memory.used)} / ${formatBytes(liveStats.memory.total)}`
                : '...'}
            </p>
          }
          progress={{
            value: memUsage,
            colorClassName: memoryTone.barClassName,
          }}
        />
        <DiskUsageCard systemInfo={systemInfo} />
      </div>
      <DockerStorageDetailsCard systemInfo={systemInfo} />
    </>
  );
}
