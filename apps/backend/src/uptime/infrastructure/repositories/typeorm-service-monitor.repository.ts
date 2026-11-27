import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThanOrEqual, Repository } from 'typeorm';
import { ServiceMonitor } from '../../domain/entities/service-monitor.entity';
import { ServiceMonitorCheck } from '../../domain/entities/service-monitor-check.entity';
import type { IServiceMonitorRepository } from '../../domain/repositories/service-monitor.repository.interface';

@Injectable()
export class TypeormServiceMonitorRepository implements IServiceMonitorRepository {
  constructor(
    @InjectRepository(ServiceMonitor)
    private readonly monitors: Repository<ServiceMonitor>,
    @InjectRepository(ServiceMonitorCheck)
    private readonly checks: Repository<ServiceMonitorCheck>,
  ) {}

  list() {
    return this.monitors.find({ order: { createdAt: 'ASC' } });
  }

  findById(id: string) {
    return this.monitors.findOne({ where: { id } });
  }

  create(input: Pick<ServiceMonitor, 'name' | 'url' | 'intervalSeconds'>) {
    return this.monitors.save(this.monitors.create(input));
  }

  async remove(id: string) {
    const result = await this.monitors.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  save(monitor: ServiceMonitor) {
    return this.monitors.save(monitor);
  }

  async addCheck(check: Omit<ServiceMonitorCheck, 'id' | 'checkedAt'>) {
    await this.checks.insert(check);
  }

  recentChecks(monitorId: string, since: Date, limit: number) {
    return this.checks.find({
      where: { monitorId, checkedAt: MoreThanOrEqual(since) },
      order: { checkedAt: 'DESC' },
      take: limit,
    });
  }

  async pruneChecks(before: Date) {
    await this.checks.delete({ checkedAt: LessThan(before) });
  }
}
