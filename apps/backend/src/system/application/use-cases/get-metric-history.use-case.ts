import { Inject, Injectable } from '@nestjs/common';
import {
  METRIC_SAMPLE_REPOSITORY,
  type IMetricSampleRepository,
} from '../../domain/repositories/metric-sample.repository.interface';
import {
  clampHistoryHours,
  downsample,
  type MetricPoint,
} from '../../domain/policies/metric-history.policy';

@Injectable()
export class GetMetricHistoryUseCase {
  constructor(
    @Inject(METRIC_SAMPLE_REPOSITORY)
    private readonly samples: IMetricSampleRepository,
  ) {}

  async execute(
    hours: unknown,
    now = new Date(),
  ): Promise<{ hours: number; points: MetricPoint[] }> {
    const range = clampHistoryHours(hours);
    const rows = await this.samples.since(
      new Date(now.getTime() - range * 60 * 60 * 1000),
    );
    return {
      hours: range,
      points: downsample(
        rows.map((row) => ({
          at: row.sampledAt,
          cpu: row.cpuPercent,
          memory: row.memoryPercent,
          disk: row.diskPercent,
        })),
      ),
    };
  }
}
