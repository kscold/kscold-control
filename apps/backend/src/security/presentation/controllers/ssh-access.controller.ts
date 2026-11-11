import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
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
import {
  SshBlockDto,
  SshBlockScopeDto,
  SshCountryGuardDto,
  SshIpDto,
  SshKnownLabelDto,
} from '../../application/dto/ssh-access.dto';
import { SshCountryGuardService } from '../../application/services/ssh-country-guard.service';
import type { CountryGuardSettings } from '../../domain/ssh-audit/country-guard.policy';

/**
 * 맥미니 SSH 접속 기록·열린 세션·차단
 * 보기는 security:read, 끊기·차단·내 IP 변경은 security:manage + 감사 기록
 */
@Controller('security/ssh')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class SshAccessController {
  constructor(
    private readonly ssh: SshAccessService,
    private readonly countryGuard: SshCountryGuardService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SECURITY_READ)
  async overview(@Query('days') days?: string) {
    const overview = await this.ssh.overview(Number(days ?? 7));
    return {
      ...overview,
      countryGuard: await this.countryGuard.status(overview.blocks),
    };
  }

  @Patch('country-guard')
  @RequirePermissions(PERMISSIONS.SECURITY_MANAGE)
  @Audit({
    domain: 'security',
    action: 'ssh.country-guard.update',
    summary: (ctx) => {
      const s = ctx.response as CountryGuardSettings;
      return `허용 국가 밖 SSH 차단을 ${s.enabled ? '켰' : '껐'}습니다 (허용 국가 ${s.allowedCountries.join(', ')}).`;
    },
    targetType: 'ssh-country-guard',
    metadata: (ctx) => ({ ...(ctx.response as CountryGuardSettings) }),
  })
  updateCountryGuard(@Body() dto: SshCountryGuardDto) {
    return this.countryGuard.update(dto);
  }

  @Post('country-guard/countries/:country/unblock')
  @RequirePermissions(PERMISSIONS.SECURITY_MANAGE)
  @Audit({
    domain: 'security',
    action: 'ssh.country-guard.unblock-country',
    summary: (ctx) => {
      const r = ctx.response as { country: string; released: string[] };
      return `허용 국가 밖 SSH 차단 중 ${r.country} 차단 ${r.released.length}개를 풀었습니다.`;
    },
    targetType: 'country',
    targetId: (ctx) => ctx.params.country,
    metadata: (ctx) => ({
      released: (ctx.response as { released: string[] }).released,
    }),
  })
  unblockCountry(@Param('country') country: string) {
    return this.countryGuard.unblockCountry(country);
  }

  @Get('blocks')
  @RequirePermissions(PERMISSIONS.SECURITY_READ)
  blocks() {
    return this.ssh.firewallBlocks();
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
      scope: (ctx.response as { scope: string }).scope,
    }),
  })
  block(@Body() dto: SshBlockDto) {
    return this.ssh.block(dto.ip, dto.reason ?? null, dto.scope ?? 'all');
  }

  @Patch('blocks/:ip')
  @RequirePermissions(PERMISSIONS.SECURITY_MANAGE)
  @Audit({
    domain: 'security',
    action: 'ssh.block.scope',
    summary: (ctx) =>
      `IP ${ctx.params.ip}의 차단 범위를 ${
        (ctx.body as SshBlockScopeDto).scope === 'ssh'
          ? 'SSH 만'
          : '모든 접속(사이트 포함)'
      }으로 바꿨습니다.`,
    targetType: 'ip',
    targetId: (ctx) => ctx.params.ip,
    metadata: (ctx) => ({ scope: (ctx.body as SshBlockScopeDto).scope }),
  })
  setScope(@Param('ip') ip: string, @Body() dto: SshBlockScopeDto) {
    return this.ssh.setBlockScope(ip, dto.scope);
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
    return { items: await this.ssh.addKnownIp(dto.ip, dto.label ?? null) };
  }

  @Patch('known-ips/:ip')
  @RequirePermissions(PERMISSIONS.SECURITY_MANAGE)
  @Audit({
    domain: 'security',
    action: 'ssh.known-ip.label',
    summary: (ctx) =>
      `내 IP ${ctx.params.ip}의 별칭을 "${
        (ctx.body as SshKnownLabelDto).label ?? ''
      }"(으)로 바꿨습니다.`,
    targetType: 'ip',
    targetId: (ctx) => ctx.params.ip,
  })
  async labelKnown(@Param('ip') ip: string, @Body() dto: SshKnownLabelDto) {
    return {
      items: await this.ssh.setKnownIpLabel(ip, dto.label ?? null),
    };
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
