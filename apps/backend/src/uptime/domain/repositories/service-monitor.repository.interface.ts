import type { ServiceMonitor } from '../entities/service-monitor.entity';
import type { ServiceMonitorCheck } from '../entities/service-monitor-check.entity';

export interface IServiceMonitorRepository {
  list(): Promise<ServiceMonitor[]>;
  findById(id: string): Promise<ServiceMonitor | null>;
  create(
    input: Pick<ServiceMonitor, 'name' | 'url' | 'intervalSeconds'>,
  ): Promise<ServiceMonitor>;
  remove(id: string): Promise<boolean>;
  save(monitor: ServiceMonitor): Promise<ServiceMonitor>;
  addCheck(check: Omit<ServiceMonitorCheck, 'id' | 'checkedAt'>): Promise<void>;
  /** 새것부터 */
  recentChecks(
    monitorId: string,
    since: Date,
    limit: number,
  ): Promise<ServiceMonitorCheck[]>;
  pruneChecks(before: Date): Promise<void>;
}

export const SERVICE_MONITOR_REPOSITORY = Symbol('SERVICE_MONITOR_REPOSITORY');
