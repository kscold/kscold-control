import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceMonitor } from './domain/entities/service-monitor.entity';
import { ServiceMonitorCheck } from './domain/entities/service-monitor-check.entity';
import { SERVICE_MONITOR_REPOSITORY } from './domain/repositories/service-monitor.repository.interface';
import { HTTP_PROBE_GATEWAY } from './domain/gateways/http-probe.gateway.interface';
import { MONITOR_NOTIFIER_GATEWAY } from './domain/gateways/monitor-notifier.gateway.interface';
import { TypeormServiceMonitorRepository } from './infrastructure/repositories/typeorm-service-monitor.repository';
import { FetchHttpProbeGateway } from './infrastructure/gateways/fetch-http-probe.gateway';
import { DiscordMonitorNotifierGateway } from './infrastructure/gateways/discord-monitor-notifier.gateway';
import { UptimeCheckerService } from './application/services/uptime-checker.service';
import { ServiceMonitorsUseCase } from './application/use-cases/service-monitors.use-case';
import { UptimeController } from './presentation/controllers/uptime.controller';

/** 사이트·API 주소를 주기적으로 열어 보고 끊기면 알리는 서비스 상태 감시 */
@Module({
  imports: [TypeOrmModule.forFeature([ServiceMonitor, ServiceMonitorCheck])],
  controllers: [UptimeController],
  providers: [
    UptimeCheckerService,
    ServiceMonitorsUseCase,
    {
      provide: SERVICE_MONITOR_REPOSITORY,
      useClass: TypeormServiceMonitorRepository,
    },
    { provide: HTTP_PROBE_GATEWAY, useClass: FetchHttpProbeGateway },
    {
      provide: MONITOR_NOTIFIER_GATEWAY,
      useClass: DiscordMonitorNotifierGateway,
    },
  ],
})
export class UptimeModule {}
