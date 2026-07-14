import { Inject, Injectable } from '@nestjs/common';

import {
  OS_METRICS_REPOSITORY,
  type IOsMetricsRepository,
} from '../../domain/repositories/os-metrics.repository';
import type { LiveStats } from '../../domain/types/system-info.type';

/** 라이브 시스템 통계(CPU/메모리/업타임) 조회 */
@Injectable()
export class GetStatsUseCase {
  constructor(
    @Inject(OS_METRICS_REPOSITORY)
    private readonly osMetrics: IOsMetricsRepository,
  ) {}

  async execute(): Promise<LiveStats> {
    const [cpu, memory] = await Promise.all([
      this.osMetrics.getCpuStats(),
      this.osMetrics.getMemoryStats(),
    ]);
    const { uptime } = this.osMetrics.getSystemMeta();

    return { cpu, memory, uptime };
  }
}
