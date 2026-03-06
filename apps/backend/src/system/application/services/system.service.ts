import { Inject, Injectable } from '@nestjs/common';

import {
  OS_METRICS_REPOSITORY,
  type IOsMetricsRepository,
} from '../../domain/interfaces/os-metrics.repository';
import type { LiveStats, SystemInfo } from '../../domain/types/system-info.type';

@Injectable()
export class SystemService {
  constructor(
    @Inject(OS_METRICS_REPOSITORY)
    private readonly osMetrics: IOsMetricsRepository,
  ) {}

  async getStats(): Promise<LiveStats> {
    const [cpu, memory] = await Promise.all([
      this.osMetrics.getCpuStats(),
      this.osMetrics.getMemoryStats(),
    ]);
    const { uptime } = this.osMetrics.getSystemMeta();

    return { cpu, memory, uptime };
  }

  async getSystemInfo(): Promise<SystemInfo> {
    const [cpu, memory, disk] = await Promise.all([
      this.osMetrics.getCpuStats(),
      this.osMetrics.getMemoryStats(),
      this.osMetrics.getDiskInfo(),
    ]);
    const { platform, hostname, uptime } = this.osMetrics.getSystemMeta();

    return {
      cpu: { count: cpu.count, model: cpu.model },
      memory,
      disk,
      platform,
      hostname,
      uptime,
    };
  }
}
