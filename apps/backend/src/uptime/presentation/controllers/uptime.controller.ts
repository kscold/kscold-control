import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../../common/guards';
import { RequirePermissions } from '../../../common/decorators';
import { Audit } from '../../../common/decorators/audit.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions';
import { CreateServiceMonitorDto } from '../../application/dto/create-service-monitor.dto';
import { ServiceMonitorsUseCase } from '../../application/use-cases/service-monitors.use-case';

@Controller('uptime')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class UptimeController {
  constructor(private readonly monitors: ServiceMonitorsUseCase) {}

  @Get('monitors')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  list() {
    return this.monitors.list();
  }

  @Post('monitors')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  @Audit({
    domain: 'uptime',
    action: 'uptime.monitor.create',
    summary: (ctx) =>
      `서비스 감시 대상 ${(ctx.body as { name?: string } | null)?.name ?? ''}을 추가했습니다.`,
    targetType: 'uptime-monitor',
  })
  create(@Body() body: CreateServiceMonitorDto) {
    return this.monitors.create(body);
  }

  @Delete('monitors/:id')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  @Audit({
    domain: 'uptime',
    action: 'uptime.monitor.delete',
    summary: (ctx) => `서비스 감시 대상 ${ctx.params.id}를 지웠습니다.`,
    targetType: 'uptime-monitor',
    targetId: (ctx) => ctx.params.id,
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.monitors.remove(id);
  }
}
