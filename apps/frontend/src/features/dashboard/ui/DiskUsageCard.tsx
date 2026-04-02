import { HardDrive } from 'lucide-react';
import type { SystemInfo } from '../lib/dashboard.types';
import { formatBytes } from '../lib/dashboard.utils';
import { MetricCard } from './MetricCard';

interface DiskUsageCardProps {
  systemInfo: SystemInfo | null;
}

export function DiskUsageCard({ systemInfo }: DiskUsageCardProps) {
  if (!systemInfo) {
    return (
      <MetricCard
        icon={<HardDrive size={18} className="text-amber-400" />}
        label="Disk"
        value={<p className="text-2xl sm:text-3xl font-bold text-white">...</p>}
      />
    );
  }

  const { disk } = systemInfo;
  return (
    <MetricCard
      icon={<HardDrive size={18} className="text-amber-400" />}
      label="Disk"
      value={
        <p className="text-lg sm:text-2xl font-bold text-white">
          {formatBytes(disk.used)} / {formatBytes(disk.total)}
        </p>
      }
      footer={
        <>
          <p className="text-xs text-gray-400">{disk.usedPercent.toFixed(1)}% used</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
              <span className="text-gray-400">
                Docker {formatBytes(disk.breakdown.docker)}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
              <span className="text-gray-400">
                Apps {formatBytes(disk.breakdown.applications)}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              <span className="text-gray-400">
                Other {formatBytes(disk.breakdown.other)}
              </span>
            </span>
          </div>
        </>
      }
      progress={{
        value: disk.usedPercent,
        colorClassName: 'bg-amber-400',
      }}
    />
  );
}
