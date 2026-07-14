import { Inject, Injectable } from '@nestjs/common';

import {
  OS_METRICS_REPOSITORY,
  type IOsMetricsRepository,
} from '../../domain/repositories/os-metrics.repository';
import type { SystemInfo } from '../../domain/types/system-info.type';

/** 시스템 정보(CPU/메모리/디스크/플랫폼) 조회 */
@Injectable()
export class GetSystemInfoUseCase {
  constructor(
    @Inject(OS_METRICS_REPOSITORY)
    private readonly osMetrics: IOsMetricsRepository,
  ) {}

  async execute(): Promise<SystemInfo> {
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
