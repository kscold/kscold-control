import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { Audit } from '../../../common/decorators/audit.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions';
import {
  SshAccessService,
  type SshSession,
} from '../../application/services/ssh-access.service';
import { SshBlockDto, SshIpDto } from '../../application/dto/ssh-access.dto';

/**
 * 맥미니 SSH 접속 기록·열린 세션·차단
 * 보기는 security:read, 끊기·차단·내 IP 변경은 security:manage + 감사 기록
 */
@Controller('security/ssh')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class SshAccessController {
  constructor(private readonly ssh: SshAccessService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SECURITY_READ)
  overview(@Query('days') days?: string) {
    return this.ssh.overview(Number(days ?? 7));
  }

  @Post('sessions/:pid/terminate')
  @RequirePermissions(PERMISSIONS.SECURITY_MANAGE)
  @Audit({
    domain: 'security',
    action: 'ssh.session.terminate',
    summary: (ctx) => {
      const s = ctx.response as SshSession;
      return `SSH 세션을 끊었습니다 (${s.user}${s.ip ? ` · ${s.ip}` : ''}).`;
    },
    targetType: 'ssh-session',
    targetId: (ctx) => ctx.params.pid,
    metadata: (ctx) => {
      const s = ctx.response as SshSession;
      return { user: s.user, ip: s.ip, startedAt: s.startedAt };
    },
  })
  terminate(@Param('pid', ParseIntPipe) pid: number) {
    return this.ssh.terminateSession(pid);
  }

  @Post('blocks')
  @RequirePermissions(PERMISSIONS.SECURITY_MANAGE)
  @Audit({
    domain: 'security',
    action: 'ssh.block.create',
    summary: (ctx) =>
      `SSH 접속에서 IP ${(ctx.response as { ip: string }).ip}를 막았습니다.`,
    targetType: 'ip',
    targetId: (ctx) => (ctx.response as { ip: string }).ip,
    metadata: (ctx) => ({
      reason: (ctx.response as { reason: string | null }).reason,
    }),
  })
  block(@Body() dto: SshBlockDto) {
    return this.ssh.block(dto.ip, dto.reason ?? null);
  }

  @Delete('blocks/:ip')
  @RequirePermissions(PERMISSIONS.SECURITY_MANAGE)
  @Audit({
    domain: 'security',
    action: 'ssh.block.delete',
    summary: (ctx) => `SSH 접속 차단에서 IP ${ctx.params.ip}를 풀었습니다.`,
    targetType: 'ip',
    targetId: (ctx) => ctx.params.ip,
    metadata: (ctx) => ({
      released: (ctx.response as { released: string[] }).released,
    }),
  })
  unblock(@Param('ip') ip: string) {
    return this.ssh.unblock(ip);
  }

  @Post('known-ips')
  @RequirePermissions(PERMISSIONS.SECURITY_MANAGE)
  @Audit({
    domain: 'security',
    action: 'ssh.known-ip.add',
    summary: (ctx) =>
      `IP ${(ctx.body as SshIpDto).ip}를 내 SSH 접속 IP로 표시했습니다.`,
    targetType: 'ip',
    targetId: (ctx) => (ctx.body as SshIpDto).ip,
  })
  async addKnown(@Body() dto: SshIpDto) {
    return { items: await this.ssh.addKnownIp(dto.ip) };
  }

  @Delete('known-ips/:ip')
  @RequirePermissions(PERMISSIONS.SECURITY_MANAGE)
  @Audit({
    domain: 'security',
    action: 'ssh.known-ip.remove',
    summary: (ctx) => `IP ${ctx.params.ip}를 내 SSH 접속 IP 목록에서 뺐습니다.`,
    targetType: 'ip',
    targetId: (ctx) => ctx.params.ip,
  })
  async removeKnown(@Param('ip') ip: string) {
    return { items: await this.ssh.removeKnownIp(ip) };
  }
}
