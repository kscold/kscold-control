import type { ReactNode } from 'react';
import { Layers3, Box, Database, PackageOpen, Trash2 } from 'lucide-react';
import { dashboardStorageTones } from '../lib/dashboard.colors';
import type { DockerStorageMetric, SystemInfo } from '../model/dashboard.types';
import { formatBytes } from '@/shared/lib';

interface DockerStorageDetailsCardProps {
  systemInfo: SystemInfo | null;
}

interface StorageRowProps {
  label: string;
  metric: DockerStorageMetric;
  icon: ReactNode;
  cardClassName: string;
  accentClassName: string;
}

function StorageRow({
  label,
  metric,
  icon,
  cardClassName,
  accentClassName,
}: StorageRowProps) {
  return (
    <div className={`rounded-xl border p-4 ${cardClassName}`}>
      <div className="flex items-center gap-2 text-sm text-gray-300">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-xl font-semibold text-white">
        {formatBytes(metric.size)}
      </p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
        <span>{metric.active} active</span>
        <span>{metric.totalCount} total</span>
        <span className={accentClassName}>
          reclaimable {formatBytes(metric.reclaimable)}
        </span>
      </div>
    </div>
  );
}

export function DockerStorageDetailsCard({
  systemInfo,
}: DockerStorageDetailsCardProps) {
  if (!systemInfo) return null;

  const { dockerUsage } = systemInfo.disk.breakdown;

  return (
    <div className="mb-6 sm:mb-8 rounded-2xl border border-gray-800 bg-gray-950/60 p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-white">
            Docker 저장소 세부 내역
          </h3>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            기준: docker system df · 엔진 내부 사용량{' '}
            {formatBytes(dockerUsage.total)}
            {dockerUsage.storagePath
              ? ` · ${dockerUsage.storageLabel} ${formatBytes(dockerUsage.storagePathSize)}`
              : ''}
          </p>
          <p className="mt-1 text-[11px] text-gray-500">
            마지막 수집{' '}
            {dockerUsage.lastCollectedAt
              ? new Date(dockerUsage.lastCollectedAt).toLocaleTimeString(
                  'ko-KR',
                )
              : '없음'}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-sm text-gray-400">Reclaimable</p>
          <p className="text-lg font-semibold text-amber-300">
            {formatBytes(dockerUsage.reclaimable)}
          </p>
        </div>
      </div>

      {dockerUsage.collectionState === 'stale' || dockerUsage.warning ? (
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {dockerUsage.warning ?? '최근 수집값을 보여주고 있습니다.'}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
        <StorageRow
          label="Images"
          metric={dockerUsage.images}
          icon={
            <Layers3
              size={16}
              className={dashboardStorageTones.images.iconClassName}
            />
          }
          cardClassName={dashboardStorageTones.images.cardClassName}
          accentClassName={dashboardStorageTones.images.textClassName}
        />
        <StorageRow
          label="Containers"
          metric={dockerUsage.containers}
          icon={
            <Box
              size={16}
              className={dashboardStorageTones.containers.iconClassName}
            />
          }
          cardClassName={dashboardStorageTones.containers.cardClassName}
          accentClassName={dashboardStorageTones.containers.textClassName}
        />
        <StorageRow
          label="Volumes"
          metric={dockerUsage.volumes}
          icon={
            <Database
              size={16}
              className={dashboardStorageTones.volumes.iconClassName}
            />
          }
          cardClassName={dashboardStorageTones.volumes.cardClassName}
          accentClassName={dashboardStorageTones.volumes.textClassName}
        />
        <StorageRow
          label="Build Cache"
          metric={dockerUsage.buildCache}
          icon={
            <PackageOpen
              size={16}
              className={dashboardStorageTones.buildCache.iconClassName}
            />
          }
          cardClassName={dashboardStorageTones.buildCache.cardClassName}
          accentClassName={dashboardStorageTones.buildCache.textClassName}
        />
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-100">
        <Trash2 size={14} className="mt-0.5 flex-shrink-0 text-amber-300" />
        <p>
          엔진 내부 사용량과 실제 저장 경로 사용량은 다를 수 있습니다. Disk
          카드는 저장 경로 기준, 이 카드는 Docker 엔진 기준으로 계산합니다.
        </p>
      </div>
    </div>
  );
}
