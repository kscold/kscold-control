import type {
  CpuStats,
  DiskBreakdown,
  DiskInfo,
  MemoryStats,
} from '../types/system-info.type';

export interface IOsMetricsRepository {
  getCpuStats(): Promise<CpuStats>;
  getMemoryStats(): Promise<MemoryStats>;
  getDiskInfo(): Promise<DiskInfo & { breakdown: DiskBreakdown }>;
  getSystemMeta(): { platform: string; hostname: string; uptime: number };
}

export const OS_METRICS_REPOSITORY = Symbol('OS_METRICS_REPOSITORY');
