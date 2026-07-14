import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions';
import { AuditLogService } from '../../../audit/application/services/audit-log.service';
import {
  CreateIpBanUseCase,
  DeleteIpBanUseCase,
  ListIpBansUseCase,
  ResyncBlocklistUseCase,
} from '../../application/use-cases';
import { CreateIpBanDto } from '../../application/dto/create-ip-ban.dto';
import type { JwtRequest } from '../../../common/types/jwt-request.type';
import type { IpBan } from '../../domain/entities/ip-ban.entity';

type SecurityRequest = Request & JwtRequest;

@Controller('security')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class SecurityController {
  constructor(
    private readonly listIpBans: ListIpBansUseCase,
    private readonly createIpBan: CreateIpBanUseCase,
    private readonly deleteIpBan: DeleteIpBanUseCase,
    private readonly resyncBlocklist: ResyncBlocklistUseCase,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('bans')
  @RequirePermissions(PERMISSIONS.SECURITY_READ)
  async listBans() {
    const items = await this.listIpBans.execute();
    return { items: items.map(toResponse) };
  }

  @Post('bans')
  @RequirePermissions(PERMISSIONS.SECURITY_MANAGE)
  async createBan(@Body() dto: CreateIpBanDto, @Req() req: SecurityRequest) {
    const requesterIp = extractIp(req);
    const actorId = req.user?.id ?? req.user?.sub ?? null;

    const ban = await this.createIpBan.execute({
      ip: dto.ip,
      reason: dto.reason ?? null,
      ttlMinutes: dto.ttlMinutes ?? null,
      createdBy: actorId,
      requesterIp,
    });

    await this.auditLogService.record({
      domain: 'security',
      action: 'ban.create',
      summary: `IP ${ban.ip}를 차단했습니다.${
        ban.reason ? ` (이유: ${ban.reason})` : ''
      }`,
      actorId,
      actorEmail: req.user?.email ?? null,
      targetType: 'ip',
      targetId: ban.ip,
      metadata: {
        banId: ban.id,
        reason: ban.reason,
        expiresAt: ban.expiresAt,
        source: ban.source,
        requesterIp,
      },
    });

    return toResponse(ban);
  }

  @Delete('bans/:id')
  @RequirePermissions(PERMISSIONS.SECURITY_MANAGE)
  async removeBan(@Param('id') id: string, @Req() req: SecurityRequest) {
    const ban = await this.deleteIpBan.execute(id);

    await this.auditLogService.record({
      domain: 'security',
      action: 'ban.delete',
      summary: `IP ${ban.ip} 차단을 해제했습니다.`,
      actorId: req.user?.id ?? req.user?.sub ?? null,
      actorEmail: req.user?.email ?? null,
      targetType: 'ip',
      targetId: ban.ip,
      metadata: {
        banId: ban.id,
        previousReason: ban.reason,
      },
    });

    return toResponse(ban);
  }

  @Post('resync')
  @RequirePermissions(PERMISSIONS.SECURITY_MANAGE)
  async resync() {
    return this.resyncBlocklist.execute();
  }
}

function toResponse(ban: IpBan) {
  return {
    id: ban.id,
    ip: ban.ip,
    reason: ban.reason,
    source: ban.source,
    active: ban.active,
    expiresAt: ban.expiresAt ? ban.expiresAt.toISOString() : null,
    createdBy: ban.createdBy,
    createdAt: ban.createdAt.toISOString(),
    updatedAt: ban.updatedAt.toISOString(),
  };
}

function extractIp(req: Request): string | null {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0]?.trim() || null;
  }
  if (Array.isArray(fwd) && fwd.length > 0) {
    return fwd[0]?.split(',')[0]?.trim() || null;
  }
  return req.ip ?? req.socket?.remoteAddress ?? null;
}
