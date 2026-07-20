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
import { Audit } from '../../../common/decorators/audit.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions';
import {
  CreateIpBanUseCase,
  DeleteIpBanUseCase,
  ListIpBansUseCase,
  ResyncBlocklistUseCase,
} from '../../application/use-cases';
import { CreateIpBanDto } from '../../application/dto/create-ip-ban.dto';
import type { JwtRequest } from '../../../common/types/jwt-request.type';
import type { IpBan } from '../../domain/entities/ip-ban.entity';

/** req._auditExtra 로 인터셉터에 넘기는 감사용 추가 데이터 */
type SecurityAuditExtra = {
  ban: IpBan;
  requesterIp: string | null;
};

type SecurityRequest = Request &
  JwtRequest & {
    _auditExtra?: SecurityAuditExtra;
  };

/**
 * 보안(IP 차단) 컨트롤러
 * 표현 계층 — HTTP 관심사만 처리합니다.
 * 횡단 관심사인 감사 로깅은 @Audit() + AuditInterceptor(AOP)가 담당합니다.
 *
 * 응답 DTO로 변환되기 전 값이 필요한 핸들러는 req._auditExtra 에 원본을 담아
 * metadata 팩토리에서 ctx.extra 로 꺼내 씁니다.
 */
@Controller('security')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class SecurityController {
  constructor(
    private readonly listIpBans: ListIpBansUseCase,
    private readonly createIpBan: CreateIpBanUseCase,
    private readonly deleteIpBan: DeleteIpBanUseCase,
    private readonly resyncBlocklist: ResyncBlocklistUseCase,
  ) {}

  @Get('bans')
  @RequirePermissions(PERMISSIONS.SECURITY_READ)
  async listBans() {
    const items = await this.listIpBans.execute();
    return { items: items.map(toResponse) };
  }

  @Post('bans')
  @RequirePermissions(PERMISSIONS.SECURITY_MANAGE)
  @Audit({
    domain: 'security',
    action: 'ban.create',
    summary: (ctx) => {
      const { ban } = ctx.extra as SecurityAuditExtra;
      return `IP ${ban.ip}를 차단했습니다.${
        ban.reason ? ` (이유: ${ban.reason})` : ''
      }`;
    },
    targetType: 'ip',
    targetId: (ctx) => (ctx.extra as SecurityAuditExtra).ban.ip,
    metadata: (ctx) => {
      const { ban, requesterIp } = ctx.extra as SecurityAuditExtra;
      return {
        banId: ban.id,
        reason: ban.reason,
        expiresAt: ban.expiresAt,
        source: ban.source,
        requesterIp,
      };
    },
  })
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

    // 요청자 IP와 엔티티 원본(expiresAt 은 Date)을 그대로 감사 기록에 남기기 위해 전달함
    req._auditExtra = { ban, requesterIp };

    return toResponse(ban);
  }

  @Delete('bans/:id')
  @RequirePermissions(PERMISSIONS.SECURITY_MANAGE)
  @Audit({
    domain: 'security',
    action: 'ban.delete',
    summary: (ctx) =>
      `IP ${(ctx.response as { ip: string }).ip} 차단을 해제했습니다.`,
    targetType: 'ip',
    targetId: (ctx) => (ctx.response as { ip: string }).ip,
    // 응답 DTO의 id·reason 은 해제된 차단 엔티티 값을 그대로 담고 있음
    metadata: (ctx) => {
      const response = ctx.response as { id: string; reason: string | null };
      return {
        banId: response.id,
        previousReason: response.reason,
      };
    },
  })
  async removeBan(@Param('id') id: string) {
    const ban = await this.deleteIpBan.execute(id);
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
