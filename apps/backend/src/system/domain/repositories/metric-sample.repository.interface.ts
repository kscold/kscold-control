import type { SystemMetricSample } from '../entities/system-metric-sample.entity';

export interface IMetricSampleRepository {
  add(sample: SystemMetricSample): Promise<void>;
  /** 오래된 것부터 */
  since(from: Date): Promise<SystemMetricSample[]>;
  pruneBefore(before: Date): Promise<void>;
}

export const METRIC_SAMPLE_REPOSITORY = Symbol('METRIC_SAMPLE_REPOSITORY');
