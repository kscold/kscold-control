import { Container, Cpu, Activity } from 'lucide-react';
import {
  getCpuProgressTone,
  getMemoryProgressTone,
} from '../lib/dashboard.colors';
import type { LiveStats, SystemInfo } from '../model/dashboard.types';
import { formatBytes } from '@/shared/lib';
import { DiskUsageCard } from './DiskUsageCard';
import { MetricCard } from './MetricCard';
import { DockerStorageDetailsCard } from './DockerStorageDetailsCard';

interface SystemStatsCardProps {
  /** 불러오지 못했으면 null — 0 으로 보이지 않게 한다 */
  containerCount: number | null;
  runningCount: number | null;
  systemInfo: SystemInfo | null;
  liveStats: LiveStats | null;
}

export function SystemStatsCard({
  containerCount,
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
      {/* 휴대폰에서 2열로 두면 키 큰 디스크 카드 옆 칸이 길게 빈다. 작은 지표 셋을 한 줄에, 디스크는 다음 줄 전체에 둔다. */}
      <div className="grid grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-5">
        <MetricCard
          icon={<Container size={18} className="text-blue-400" />}
          label="Containers"
          value={
            <p className="text-xl sm:text-3xl font-bold text-white">
              {containerCount ?? '…'}
            </p>
          }
          footer={
            <p className="text-xs text-green-400">
              {runningCount === null ? '확인 중' : `${runningCount} running`}
            </p>
          }
        />
        <MetricCard
          icon={<Cpu size={18} className={cpuTone.iconClassName} />}
          label="CPU"
          value={
            <p className="text-xl sm:text-3xl font-bold text-white">
              {liveStats ? `${cpuUsage.toFixed(1)}%` : '…'}
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
            <p className="text-xl sm:text-3xl font-bold text-white">
              {liveStats ? `${memUsage.toFixed(1)}%` : '…'}
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
        <div className="col-span-3 lg:col-span-1">
          <DiskUsageCard systemInfo={systemInfo} />
        </div>
      </div>
      <DockerStorageDetailsCard systemInfo={systemInfo} />
    </>
  );
}
