import { HardDrive } from 'lucide-react';
import {
  dashboardStorageTones,
  getDiskProgressTone,
} from '../lib/dashboard.colors';
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
        icon={<HardDrive size={18} className="text-orange-300" />}
        label="Disk"
        value={<p className="text-2xl sm:text-3xl font-bold text-white">...</p>}
      />
    );
  }

  const { disk } = systemInfo;
  const diskTone = getDiskProgressTone(disk.usedPercent);

  const detailItems = [
    {
      label: '저장 경로 기준 Docker',
      value: formatBytes(disk.breakdown.docker),
      tone: dashboardStorageTones.storageDocker,
    },
    {
      label: '엔진 내부 Docker',
      value: formatBytes(disk.breakdown.dockerUsage.total),
      tone: dashboardStorageTones.engineDocker,
    },
    {
      label: '재확보 가능',
      value: formatBytes(disk.breakdown.dockerUsage.reclaimable),
      tone: dashboardStorageTones.reclaimable,
    },
    {
      label: '앱',
      value: formatBytes(disk.breakdown.applications),
      tone: dashboardStorageTones.applications,
    },
  ];

  const legendItems = [
    {
      label: 'Docker',
      value: formatBytes(disk.breakdown.docker),
      tone: dashboardStorageTones.storageDocker,
    },
    {
      label: 'Apps',
      value: formatBytes(disk.breakdown.applications),
      tone: dashboardStorageTones.applications,
    },
    {
      label: 'Other',
      value: formatBytes(disk.breakdown.other),
      tone: dashboardStorageTones.other,
    },
  ];

  return (
    <MetricCard
      icon={<HardDrive size={18} className={diskTone.iconClassName} />}
      label="Disk"
      value={
        <p className="text-lg sm:text-2xl font-bold text-white">
          {formatBytes(disk.used)} / {formatBytes(disk.total)}
        </p>
      }
      footer={
        <>
          <p className="text-xs text-gray-400">{disk.usedPercent.toFixed(1)}% used</p>
          <div className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            {detailItems.map((item) => (
              <div
                key={item.label}
                className={`rounded-lg border px-2.5 py-2 ${item.tone.cardClassName}`}
              >
                <p className={`text-[11px] ${item.tone.textClassName}`}>{item.label}</p>
                <p className="mt-1 text-sm font-medium text-white">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs">
            {legendItems.map((item) => (
              <span key={item.label} className="flex items-center gap-1">
                <span className={`inline-block h-2 w-2 rounded-full ${item.tone.dotClassName}`} />
                <span className={`${item.tone.textClassName}`}>
                  {item.label} {item.value}
                </span>
              </span>
            ))}
          </div>
        </>
      }
      progress={{
        value: disk.usedPercent,
        colorClassName: diskTone.barClassName,
      }}
    />
  );
}
