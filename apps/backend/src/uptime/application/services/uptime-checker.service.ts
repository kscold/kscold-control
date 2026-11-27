import { Inject, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import {
  HTTP_PROBE_GATEWAY,
  type IHttpProbeGateway,
} from '../../domain/gateways/http-probe.gateway.interface';
import {
  MONITOR_NOTIFIER_GATEWAY,
  type IMonitorNotifierGateway,
} from '../../domain/gateways/monitor-notifier.gateway.interface';
import {
  SERVICE_MONITOR_REPOSITORY,
  type IServiceMonitorRepository,
} from '../../domain/repositories/service-monitor.repository.interface';
import type { ServiceMonitor } from '../../domain/entities/service-monitor.entity';
import {
  CHECK_RETENTION_DAYS,
  FAILURES_BEFORE_DOWN,
  nextMonitorState,
  shouldNotify,
} from '../../domain/policies/monitor-status.policy';

const DAY_MS = 24 * 60 * 60 * 1000;

/** 30초마다 때가 된 감시 대상을 검사하고, 상태가 바뀌면 알린다 */
@Injectable()
export class UptimeCheckerService {
  private readonly logger = new Logger(UptimeCheckerService.name);
  private running = false;
  private lastPrune = 0;

  constructor(
    @Inject(SERVICE_MONITOR_REPOSITORY)
    private readonly monitors: IServiceMonitorRepository,
    @Inject(HTTP_PROBE_GATEWAY) private readonly probe: IHttpProbeGateway,
    @Inject(MONITOR_NOTIFIER_GATEWAY)
    private readonly notifier: IMonitorNotifierGateway,
  ) {}

  @Interval('uptime-checker', 30_000)
  async tick(now = new Date()): Promise<void> {
    // 검사가 30초보다 오래 걸려도 겹쳐 돌지 않게 한다
    if (this.running) return;
    this.running = true;
    try {
      const due = (await this.monitors.list()).filter(
        (monitor) =>
          monitor.enabled &&
          (!monitor.lastCheckedAt ||
            now.getTime() - monitor.lastCheckedAt.getTime() >=
              monitor.intervalSeconds * 1000 - 5_000),
      );
      await Promise.all(due.map((monitor) => this.check(monitor, now)));
      if (now.getTime() - this.lastPrune > DAY_MS / 4) {
        this.lastPrune = now.getTime();
        await this.monitors.pruneChecks(
          new Date(now.getTime() - CHECK_RETENTION_DAYS * DAY_MS),
        );
      }
    } catch (error) {
      this.logger.error(
        `감시 실패: ${error instanceof Error ? error.message : error}`,
      );
    } finally {
      this.running = false;
    }
  }

  async check(monitor: ServiceMonitor, now = new Date()): Promise<void> {
    const result = await this.probe.probe(monitor.url);
    await this.monitors.addCheck({ monitorId: monitor.id, ...result });
    const recent = await this.monitors.recentChecks(
      monitor.id,
      new Date(0),
      FAILURES_BEFORE_DOWN,
    );
    const previous = monitor.state;
    const next = nextMonitorState(previous, recent);
    monitor.lastCheckedAt = now;
    if (next !== previous) {
      monitor.state = next;
      monitor.stateChangedAt = now;
    }
    await this.monitors.save(monitor);
    if (shouldNotify(previous, next) && next !== 'unknown') {
      await this.notifier.notify({
        name: monitor.name,
        url: monitor.url,
        state: next,
        detail: result.error,
      });
    }
  }
}
