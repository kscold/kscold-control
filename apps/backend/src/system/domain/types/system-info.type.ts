export interface CpuStats {
  usage: number;
  count: number;
  model: string;
}

export interface MemoryStats {
  total: number;
  used: number;
  free: number;
  usedPercent: number;
}

export interface DiskInfo {
  total: number;
  used: number;
  available: number;
  usedPercent: number;
}

export interface DiskBreakdown {
  docker: number;
  applications: number;
  other: number;
}

export interface LiveStats {
  cpu: CpuStats;
  memory: MemoryStats;
  uptime: number;
}

export interface SystemInfo {
  cpu: Pick<CpuStats, 'count' | 'model'>;
  memory: MemoryStats;
  disk: DiskInfo & { breakdown: DiskBreakdown };
  platform: string;
  hostname: string;
  uptime: number;
}
