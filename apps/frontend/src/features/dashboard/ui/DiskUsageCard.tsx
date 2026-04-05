import { HardDrive } from 'lucide-react';
import {
  dashboardStorageTones,
  getDiskProgressTone,
} from '../lib/dashboard.colors';
import type { SystemInfo } from '../lib/dashboard.types';
import { formatBytes } from '../lib/dashboard.utils';
import { MetricCard } from './MetricCard';
import { StackedUsageBar } from './StackedUsageBar';

interface DiskUsageCardProps {
  systemInfo: SystemInfo | null;
}

export function DiskUsageCard({ systemInfo }: DiskUsageCardProps) {
  if (!systemInfo) {
    return (
      <MetricCard
        icon={<HardDrive size={18} className="text-orange-300" />}
        label="Disk"
        className="min-h-[332px]"
        value={
          <div className="space-y-3">
            <div className="h-10 w-44 animate-pulse rounded-lg bg-gray-800/85" />
            <div className="h-3 w-full animate-pulse rounded-full bg-gray-800/85" />
          </div>
        }
        footer={
          <div className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-lg border border-gray-800 bg-gray-950/60 px-2.5 py-2"
              >
                <div className="h-3 w-20 animate-pulse rounded-md bg-gray-800/85" />
                <div className="mt-2 h-6 w-24 animate-pulse rounded-md bg-gray-800/85" />
              </div>
            ))}
          </div>
        }
      />
    );
  }

  const { disk } = systemInfo;
  const diskTone = getDiskProgressTone(disk.usedPercent);
  const diskSegments = [
    {
      label: 'Docker',
      value: disk.breakdown.docker,
      tone: dashboardStorageTones.storageDocker,
      colorClassName: dashboardStorageTones.storageDocker.barClassName,
    },
    {
      label: 'Apps',
      value: disk.breakdown.applications,
      tone: dashboardStorageTones.applications,
      colorClassName: dashboardStorageTones.applications.barClassName,
    },
    {
      label: 'Other',
      value: disk.breakdown.other,
      tone: dashboardStorageTones.other,
      colorClassName: dashboardStorageTones.other.barClassName,
    },
    {
      label: 'Free',
      value: disk.available,
      tone: dashboardStorageTones.free,
      colorClassName: dashboardStorageTones.free.barClassName,
    },
  ];

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

  const legendItems = diskSegments;

  return (
    <MetricCard
      icon={<HardDrive size={18} className={diskTone.iconClassName} />}
      label="Disk"
      className="min-h-[332px]"
      value={
        <p className="text-lg sm:text-2xl font-bold text-white">
          {formatBytes(disk.used)} / {formatBytes(disk.total)}
        </p>
      }
      footer={
        <>
          <div className="mt-2">
            <StackedUsageBar
              total={disk.total}
              segments={diskSegments.map((item) => ({
                label: item.label,
                value: item.value,
                colorClassName: item.colorClassName,
              }))}
            />
          </div>
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
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    item.colorClassName ?? item.tone.dotClassName
                  }`}
                />
                <span className={`${item.tone.textClassName}`}>
                  {item.label} {formatBytes(item.value)}
                </span>
              </span>
            ))}
          </div>
        </>
      }
    />
  );
}
