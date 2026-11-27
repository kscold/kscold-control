import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  SERVICE_MONITOR_REPOSITORY,
  type IServiceMonitorRepository,
} from '../../domain/repositories/service-monitor.repository.interface';
import {
  isMonitorUrl,
  summarizeChecks,
  type MonitorState,
} from '../../domain/policies/monitor-status.policy';
import type { CreateServiceMonitorDto } from '../dto/create-service-monitor.dto';
import { UptimeCheckerService } from '../services/uptime-checker.service';

const DAY_MS = 24 * 60 * 60 * 1000;
/** 화면의 작은 그래프에 쓰는 최근 검사 수 */
const RECENT_POINTS = 40;

export interface ServiceMonitorView {
  id: string;
  name: string;
  url: string;
  intervalSeconds: number;
  enabled: boolean;
  state: MonitorState;
  stateChangedAt: string | null;
  lastCheckedAt: string | null;
  uptime24hPercent: number | null;
  averageLatencyMs: number | null;
  lastError: string | null;
  /** 오래된 것부터, 실패는 latency null */
  recent: { at: string; ok: boolean; latencyMs: number | null }[];
}

@Injectable()
export class ServiceMonitorsUseCase {
  constructor(
    @Inject(SERVICE_MONITOR_REPOSITORY)
    private readonly monitors: IServiceMonitorRepository,
    private readonly checker: UptimeCheckerService,
  ) {}

  async list(now = new Date()): Promise<ServiceMonitorView[]> {
    const since = new Date(now.getTime() - DAY_MS);
    const monitors = await this.monitors.list();
    return Promise.all(
      monitors.map(async (monitor) => {
        const checks = await this.monitors.recentChecks(
          monitor.id,
          since,
          3000,
        );
        const summary = summarizeChecks(checks);
        return {
          id: monitor.id,
          name: monitor.name,
          url: monitor.url,
          intervalSeconds: monitor.intervalSeconds,
          enabled: monitor.enabled,
          state: monitor.state,
          stateChangedAt: monitor.stateChangedAt?.toISOString() ?? null,
          lastCheckedAt: monitor.lastCheckedAt?.toISOString() ?? null,
          uptime24hPercent: summary.uptimePercent,
          averageLatencyMs: summary.averageLatencyMs,
          lastError: checks[0] && !checks[0].ok ? checks[0].error : null,
          recent: checks
            .slice(0, RECENT_POINTS)
            .reverse()
            .map((check) => ({
              at: check.checkedAt.toISOString(),
              ok: check.ok,
              latencyMs: check.latencyMs,
            })),
        };
      }),
    );
  }

  async create(input: CreateServiceMonitorDto) {
    const url = input.url.trim();
    if (!isMonitorUrl(url)) {
      throw new BadRequestException(
        'http:// 또는 https:// 로 시작하는 주소만 감시할 수 있습니다.',
      );
    }
    const monitor = await this.monitors.create({
      name: input.name.trim(),
      url,
      intervalSeconds: input.intervalSeconds ?? 60,
    });
    // 등록하자마자 한 번 확인해 화면에 바로 상태가 나오게 한다
    await this.checker.check(monitor);
    return { id: monitor.id };
  }

  async remove(id: string) {
    if (!(await this.monitors.remove(id))) {
      throw new NotFoundException('감시 대상을 찾을 수 없습니다.');
    }
    return { deleted: true };
  }
}
