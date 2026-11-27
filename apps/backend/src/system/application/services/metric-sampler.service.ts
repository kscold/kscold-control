import { Inject, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import {
  OS_METRICS_REPOSITORY,
  type IOsMetricsRepository,
} from '../../domain/repositories/os-metrics.repository.interface';
import {
  METRIC_SAMPLE_REPOSITORY,
  type IMetricSampleRepository,
} from '../../domain/repositories/metric-sample.repository.interface';
import { METRIC_RETENTION_HOURS } from '../../domain/policies/metric-history.policy';

const HOUR_MS = 60 * 60 * 1000;

/** 1분마다 사용률을 남긴다. 디스크는 1분 캐시를 쓰므로 추가 부담이 없다. */
@Injectable()
export class MetricSamplerService {
  private readonly logger = new Logger(MetricSamplerService.name);

  constructor(
    @Inject(OS_METRICS_REPOSITORY) private readonly os: IOsMetricsRepository,
    @Inject(METRIC_SAMPLE_REPOSITORY)
    private readonly samples: IMetricSampleRepository,
  ) {}

  @Interval('metric-sampler', 60_000)
  async sample(now = new Date()): Promise<void> {
    try {
      const [cpu, memory, disk] = await Promise.all([
        this.os.getCpuStats(),
        this.os.getMemoryStats(),
        this.os.getDiskInfo().catch(() => null),
      ]);
      const minute = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
      await this.samples.add({
        sampledAt: minute,
        cpuPercent: cpu.usage,
        memoryPercent: memory.usedPercent,
        diskPercent: disk ? disk.usedPercent : null,
      });
      if (minute.getMinutes() === 0) {
        await this.samples.pruneBefore(
          new Date(now.getTime() - METRIC_RETENTION_HOURS * HOUR_MS),
        );
      }
    } catch (error) {
      this.logger.warn(
        `사용률 기록 실패: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
