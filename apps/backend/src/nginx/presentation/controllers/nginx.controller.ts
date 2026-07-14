import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions';
import {
  ListNginxSitesUseCase,
  CreateNginxSiteUseCase,
  UpdateNginxSiteUseCase,
  DeleteNginxSiteUseCase,
  ToggleNginxSiteUseCase,
  TestNginxConfigUseCase,
  ReloadNginxUseCase,
  GetNginxUpstreamsUseCase,
  ListCertsUseCase,
  IssueCertUseCase,
  RenewCertsUseCase,
  GetCertRenewalStatusUseCase,
  GetPublicIpUseCase,
  VerifyDnsUseCase,
  VerifyAllDnsUseCase,
} from '../../application/use-cases';
import { CreateNginxSiteRequestDto } from '../dto/create-nginx-site.request.dto';
import type { JwtRequest } from '../../../common/types/jwt-request.type';
import { AuditLogService } from '../../../audit/application/services/audit-log.service';

@Controller('nginx')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class NginxController {
  constructor(
    private readonly listSitesUseCase: ListNginxSitesUseCase,
    private readonly createSiteUseCase: CreateNginxSiteUseCase,
    private readonly updateSiteUseCase: UpdateNginxSiteUseCase,
    private readonly deleteSiteUseCase: DeleteNginxSiteUseCase,
    private readonly toggleSiteUseCase: ToggleNginxSiteUseCase,
    private readonly testConfigUseCase: TestNginxConfigUseCase,
    private readonly reloadNginxUseCase: ReloadNginxUseCase,
    private readonly getUpstreamsUseCase: GetNginxUpstreamsUseCase,
    private readonly listCertsUseCase: ListCertsUseCase,
    private readonly issueCertUseCase: IssueCertUseCase,
    private readonly renewCertsUseCase: RenewCertsUseCase,
    private readonly getRenewalStatusUseCase: GetCertRenewalStatusUseCase,
    private readonly getPublicIpUseCase: GetPublicIpUseCase,
    private readonly verifyDnsUseCase: VerifyDnsUseCase,
    private readonly verifyAllDnsUseCase: VerifyAllDnsUseCase,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('sites')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  listSites() {
    return this.listSitesUseCase.execute();
  }

  @Post('sites')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  async createSite(
    @Body() dto: CreateNginxSiteRequestDto,
    @Request() req: JwtRequest,
  ) {
    const result = await this.createSiteUseCase.execute(dto);
    await this.auditLogService.record({
      domain: 'nginx',
      action: 'site.create',
      summary: `Nginx 사이트 ${dto.name}(${dto.domain})를 생성했습니다.`,
      actorId: req.user?.id ?? req.user?.sub ?? null,
      actorEmail: req.user?.email ?? null,
      targetType: 'site',
      targetId: dto.name,
      metadata: {
        after: this.toSiteSnapshot(result),
        testResult: result.testResult.success,
      },
    });
    return result;
  }

  @Put('sites/:name')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  async updateSite(
    @Param('name') name: string,
    @Body() dto: CreateNginxSiteRequestDto,
    @Request() req: JwtRequest,
  ) {
    const beforeSite = await this.getSiteSnapshot(name);
    const result = await this.updateSiteUseCase.execute(name, dto);
    await this.auditLogService.record({
      domain: 'nginx',
      action: 'site.update',
      summary: `Nginx 사이트 ${name} 설정을 수정했습니다.`,
      actorId: req.user?.id ?? req.user?.sub ?? null,
      actorEmail: req.user?.email ?? null,
      targetType: 'site',
      targetId: name,
      metadata: {
        before: beforeSite,
        after: this.toSiteSnapshot(result),
        testResult: result.testResult.success,
      },
    });
    return result;
  }

  @Delete('sites/:name')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  async deleteSite(@Param('name') name: string, @Request() req: JwtRequest) {
    const beforeSite = await this.getSiteSnapshot(name);
    const result = await this.deleteSiteUseCase.execute(name);
    await this.auditLogService.record({
      domain: 'nginx',
      action: 'site.delete',
      summary: `Nginx 사이트 ${name}를 삭제했습니다.`,
      actorId: req.user?.id ?? req.user?.sub ?? null,
      actorEmail: req.user?.email ?? null,
      targetType: 'site',
      targetId: name,
      metadata: {
        before: beforeSite,
        testResult: result.testResult.success,
      },
    });
    return result;
  }

  @Post('sites/:name/toggle')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  async toggleSite(@Param('name') name: string, @Request() req: JwtRequest) {
    const beforeSite = await this.getSiteSnapshot(name);
    const result = await this.toggleSiteUseCase.execute(name);
    await this.auditLogService.record({
      domain: 'nginx',
      action: result.enabled ? 'site.enable' : 'site.disable',
      summary: `Nginx 사이트 ${name}를 ${result.enabled ? '활성화' : '비활성화'}했습니다.`,
      actorId: req.user?.id ?? req.user?.sub ?? null,
      actorEmail: req.user?.email ?? null,
      targetType: 'site',
      targetId: name,
      metadata: {
        before: beforeSite,
        after: beforeSite
          ? {
              ...beforeSite,
              enabled: result.enabled,
            }
          : {
              enabled: result.enabled,
            },
        testResult: result.testResult.success,
      },
    });
    return result;
  }

  @Post('test')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  testConfig() {
    return this.testConfigUseCase.execute();
  }

  @Post('reload')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  async reloadNginx(@Request() req: JwtRequest) {
    const result = await this.reloadNginxUseCase.execute();
    await this.auditLogService.record({
      domain: 'nginx',
      action: 'reload',
      summary: 'Nginx 리로드를 실행했습니다.',
      actorId: req.user?.id ?? req.user?.sub ?? null,
      actorEmail: req.user?.email ?? null,
      targetType: 'service',
      targetId: 'kscold-nginx',
    });
    return result;
  }

  /**
   * Get available container upstreams for proxy configuration
   * Returns running containers with their internal ports
   */
  @Get('upstreams')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  getUpstreams() {
    return this.getUpstreamsUseCase.execute();
  }

  // ===== SSL Certificate Endpoints =====

  /**
   * List all SSL certificates
   * GET /nginx/certs
   */
  @Get('certs')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  listCerts() {
    return this.listCertsUseCase.execute();
  }

  /**
   * Issue a new SSL certificate
   * POST /nginx/certs/issue
   */
  @Post('certs/issue')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  async issueCert(
    @Body() body: { domain: string; email: string; mode?: string },
    @Request() req: JwtRequest,
  ) {
    const result = await this.issueCertUseCase.execute(
      body.domain,
      body.email,
      body.mode,
    );

    await this.auditLogService.record({
      domain: 'nginx',
      action: 'cert.issue',
      summary: `도메인 ${body.domain} 인증서 발급을 실행했습니다.`,
      actorId: req.user?.id ?? req.user?.sub ?? null,
      actorEmail: req.user?.email ?? null,
      targetType: 'certificate',
      targetId: body.domain,
      metadata: {
        email: body.email,
        mode: body.mode ?? 'webroot',
      },
    });

    return result;
  }

  /**
   * Renew all certificates
   * POST /nginx/certs/renew
   */
  @Post('certs/renew')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  async renewCerts(@Request() req: JwtRequest) {
    const result = await this.renewCertsUseCase.execute();
    await this.auditLogService.record({
      domain: 'nginx',
      action: 'cert.renew-all',
      summary: '인증서 전체 갱신을 실행했습니다.',
      actorId: req.user?.id ?? req.user?.sub ?? null,
      actorEmail: req.user?.email ?? null,
      targetType: 'certificate',
      targetId: 'all',
    });
    return result;
  }

  /**
   * 인증서 자동 갱신 스케줄 상태 (마지막 실행 결과 + 만료 요약)
   * GET /nginx/certs/renewal-status
   */
  @Get('certs/renewal-status')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  getRenewalStatus() {
    return this.getRenewalStatusUseCase.execute();
  }

  // ===== DNS Management Endpoints =====

  /**
   * Get public IP of this server
   * GET /nginx/dns/ip
   */
  @Get('dns/ip')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  getPublicIp() {
    return this.getPublicIpUseCase.execute();
  }

  /**
   * Verify DNS for a single domain
   * POST /nginx/dns/verify
   */
  @Post('dns/verify')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  verifyDns(@Body() body: { domain: string }) {
    return this.verifyDnsUseCase.execute(body.domain);
  }

  /**
   * Verify DNS for all configured proxy domains
   * GET /nginx/dns/verify-all
   */
  @Get('dns/verify-all')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  verifyAllDns() {
    return this.verifyAllDnsUseCase.execute();
  }

  private async getSiteSnapshot(name: string) {
    const items = await this.listSitesUseCase.execute();
    return this.toSiteSnapshot(
      items.find((item) => item.name === name) ?? null,
    );
  }

  private toSiteSnapshot(
    site:
      | {
          name: string;
          domain: string;
          upstream: string;
          ssl: boolean;
          websocket: boolean;
          enabled: boolean;
        }
      | null
      | undefined,
  ) {
    if (!site) {
      return null;
    }

    return {
      name: site.name,
      domain: site.domain,
      upstream: site.upstream,
      ssl: site.ssl,
      websocket: site.websocket,
      enabled: site.enabled,
    };
  }
}
