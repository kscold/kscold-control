import type { DockerStorageMetric, DockerStorageUsage } from '../../domain/types/system-info.type';

const EMPTY_METRIC: DockerStorageMetric = {
  size: 0,
  reclaimable: 0,
  active: 0,
  totalCount: 0,
};

const EMPTY_USAGE: DockerStorageUsage = {
  total: 0,
  reclaimable: 0,
  storageLabel: 'Docker',
  storagePath: null,
  storagePathSize: 0,
  lastCollectedAt: null,
  collectionState: 'fresh',
  warning: null,
  images: { ...EMPTY_METRIC },
  containers: { ...EMPTY_METRIC },
  volumes: { ...EMPTY_METRIC },
  buildCache: { ...EMPTY_METRIC },
};

const SIZE_UNITS: Record<string, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4,
  PB: 1024 ** 5,
  KIB: 1024,
  MIB: 1024 ** 2,
  GIB: 1024 ** 3,
  TIB: 1024 ** 4,
  PIB: 1024 ** 5,
};

interface DockerDfRow {
  Type: string;
  Size: string;
  Reclaimable: string;
  Active: string;
  TotalCount: string;
}

export function parseDockerSizeToBytes(value: string): number {
  const normalized = value.trim().toUpperCase();
  if (!normalized || normalized === '0' || normalized === '0B') return 0;

  const match = normalized.match(/^([\d.]+)\s*([A-Z]+)$/);
  if (!match) return 0;

  const amount = parseFloat(match[1]);
  const unit = match[2];
  const multiplier = SIZE_UNITS[unit];
  if (!multiplier || Number.isNaN(amount)) return 0;

  return Math.round(amount * multiplier);
}

export function parseDockerReclaimableToBytes(value: string): number {
  return parseDockerSizeToBytes(value.split('(')[0] || '0B');
}

export function parseDockerSystemDfOutput(stdout: string): DockerStorageUsage {
  const usage: DockerStorageUsage = {
    ...EMPTY_USAGE,
    images: { ...EMPTY_METRIC },
    containers: { ...EMPTY_METRIC },
    volumes: { ...EMPTY_METRIC },
    buildCache: { ...EMPTY_METRIC },
  };

  for (const line of stdout.split('\n').map((entry) => entry.trim()).filter(Boolean)) {
    try {
      const row = JSON.parse(line) as DockerDfRow;
      const metric: DockerStorageMetric = {
        size: parseDockerSizeToBytes(row.Size),
        reclaimable: parseDockerReclaimableToBytes(row.Reclaimable),
        active: parseInt(row.Active, 10) || 0,
        totalCount: parseInt(row.TotalCount, 10) || 0,
      };

      if (row.Type === 'Images') usage.images = metric;
      if (row.Type === 'Containers') usage.containers = metric;
      if (row.Type === 'Local Volumes') usage.volumes = metric;
      if (row.Type === 'Build Cache') usage.buildCache = metric;
    } catch {
      continue;
    }
  }

  usage.total =
    usage.images.size +
    usage.containers.size +
    usage.volumes.size +
    usage.buildCache.size;
  usage.reclaimable =
    usage.images.reclaimable +
    usage.containers.reclaimable +
    usage.volumes.reclaimable +
    usage.buildCache.reclaimable;

  return usage;
}
