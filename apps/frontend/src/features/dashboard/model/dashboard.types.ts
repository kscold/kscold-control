export interface DashboardContainerSummary {
  total: number;
  running: number;
}

export interface DockerStorageMetric {
  size: number;
  reclaimable: number;
  active: number;
  totalCount: number;
}

export interface DockerStorageUsage {
  total: number;
  reclaimable: number;
  storageLabel: string;
  storagePath: string | null;
  storagePathSize: number;
  lastCollectedAt: number | null;
  collectionState: 'fresh' | 'stale';
  warning: string | null;
  images: DockerStorageMetric;
  containers: DockerStorageMetric;
  volumes: DockerStorageMetric;
  buildCache: DockerStorageMetric;
}

export interface SystemInfo {
  cpu: { count: number; model: string };
  memory: { total: number; used: number; free: number; usedPercent: number };
  disk: {
    total: number;
    used: number;
    available: number;
    usedPercent: number;
    breakdown: {
      docker: number;
      applications: number;
      other: number;
      dockerUsage: DockerStorageUsage;
    };
  };
  platform: string;
  hostname: string;
  uptime: number;
}

export interface LiveStats {
  cpu: { usage: number; count: number; model: string };
  memory: { total: number; used: number; free: number; usedPercent: number };
  uptime: number;
}
