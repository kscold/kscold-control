import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThanOrEqual, Repository } from 'typeorm';
import { SystemMetricSample } from '../../domain/entities/system-metric-sample.entity';
import type { IMetricSampleRepository } from '../../domain/repositories/metric-sample.repository.interface';

@Injectable()
export class TypeormMetricSampleRepository implements IMetricSampleRepository {
  constructor(
    @InjectRepository(SystemMetricSample)
    private readonly samples: Repository<SystemMetricSample>,
  ) {}

  async add(sample: SystemMetricSample) {
    // 재시작 직후 같은 분에 두 번 저장될 수 있어 덮어쓴다
    await this.samples.upsert(sample, ['sampledAt']);
  }

  since(from: Date) {
    return this.samples.find({
      where: { sampledAt: MoreThanOrEqual(from) },
      order: { sampledAt: 'ASC' },
    });
  }

  async pruneBefore(before: Date) {
    await this.samples.delete({ sampledAt: LessThan(before) });
  }
}
