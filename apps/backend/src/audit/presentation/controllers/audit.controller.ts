import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions';
import { AuditLogService } from '../../application/services/audit-log.service';
import type { AuditDomain } from '../../domain/types/audit-event.type';

@Controller('audit')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class AuditController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get('events')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  async listEvents(
    @Query('domain') domain?: AuditDomain | 'all',
    @Query('actor') actor?: string,
    @Query('actorId') actorId?: string,
    @Query('target') target?: string,
    @Query('targetId') targetId?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = parseInt(limitRaw ?? '', 10);
    const items = await this.auditLogService.list({
      domain: domain ?? 'all',
      actor,
      actorId,
      target,
      targetId,
      search,
      from,
      to,
      limit: Number.isFinite(limit) ? limit : 120,
    });

    return { items };
  }

  @Get('summary')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  async getSummary(
    @Query('domain') domain?: AuditDomain | 'all',
    @Query('actor') actor?: string,
    @Query('actorId') actorId?: string,
    @Query('target') target?: string,
    @Query('targetId') targetId?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const item = await this.auditLogService.summarize({
      domain: domain ?? 'all',
      actor,
      actorId,
      target,
      targetId,
      search,
      from,
      to,
    });

    return { item };
  }
}
