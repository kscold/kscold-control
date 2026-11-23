import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions';
import {
  ExportAuditEventsUseCase,
  GetAuditFeedUseCase,
  ListAuditEventsUseCase,
  SummarizeAuditEventsUseCase,
} from '../../application/use-cases';
import type { AuditDomain } from '../../domain/types/audit-event.type';

@Controller('audit')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class AuditController {
  constructor(
    private readonly listAuditEvents: ListAuditEventsUseCase,
    private readonly summarizeAuditEvents: SummarizeAuditEventsUseCase,
    private readonly exportAuditEvents: ExportAuditEventsUseCase,
    private readonly getAuditFeed: GetAuditFeedUseCase,
  ) {}

  /** 감사 화면 목록: 확인할 일·사람·자동 보기와 반복 묶음 */
  @Get('feed')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  async getFeed(
    @Query('view') view?: string,
    @Query('domain') domain?: AuditDomain | 'all',
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const limit = parseInt(limitRaw ?? '', 10);
    const views = ['attention', 'human', 'system', 'all'] as const;
    return this.getAuditFeed.execute({
      view: views.find((value) => value === view) ?? 'all',
      domain: domain ?? 'all',
      search,
      from,
      to,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
  }

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
    const items = await this.listAuditEvents.execute({
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
    const item = await this.summarizeAuditEvents.execute({
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

  @Get('export')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  async exportEvents(
    @Query('domain') domain?: AuditDomain | 'all',
    @Query('actor') actor?: string,
    @Query('actorId') actorId?: string,
    @Query('target') target?: string,
    @Query('targetId') targetId?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const item = await this.exportAuditEvents.execute({
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
