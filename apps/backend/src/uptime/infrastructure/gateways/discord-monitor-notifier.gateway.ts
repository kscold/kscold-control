import { Injectable, Logger } from '@nestjs/common';
import type {
  IMonitorNotifierGateway,
  MonitorAlert,
} from '../../domain/gateways/monitor-notifier.gateway.interface';

/**
 * UPTIME_DISCORD_WEBHOOK_URL 이 있으면 디스코드로 알린다.
 * 알림이 실패해도 감시는 계속 돌아야 하므로 실패는 기록만 하고 넘긴다.
 */
@Injectable()
export class DiscordMonitorNotifierGateway implements IMonitorNotifierGateway {
  private readonly logger = new Logger(DiscordMonitorNotifierGateway.name);

  async notify(alert: MonitorAlert): Promise<void> {
    const webhook = process.env.UPTIME_DISCORD_WEBHOOK_URL;
    if (!webhook) return;
    const icon = alert.state === 'down' ? '🔴' : '🟢';
    const word = alert.state === 'down' ? '응답 없음' : '복구됨';
    const content = `${icon} **${alert.name}** ${word}\n${alert.url}${alert.detail ? `\n${alert.detail}` : ''}`;
    try {
      const response = await fetch(webhook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        this.logger.warn(`디스코드 알림 실패: HTTP ${response.status}`);
      }
    } catch (error) {
      this.logger.warn(
        `디스코드 알림 실패: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
