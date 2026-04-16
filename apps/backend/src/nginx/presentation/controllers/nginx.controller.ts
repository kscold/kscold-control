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
import { NginxSiteService } from '../../application/services/nginx-site.service';
import { CertService } from '../../application/services/cert.service';
import { DnsService } from '../../application/services/dns.service';
import { ListContainersUseCase } from '../../../docker/application/use-cases';
import type { CreateNginxSiteDto } from '../../domain/types/nginx-site.type';
import type { JwtRequest } from '../../../common/types/jwt-request.type';
import { AuditLogService } from '../../../audit/application/services/audit-log.service';

@Controller('nginx')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class NginxController {
  constructor(
    private readonly nginxSiteService: NginxSiteService,
    private readonly certService: CertService,
    private readonly dnsService: DnsService,
    private readonly listContainersUseCase: ListContainersUseCase,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('sites')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  listSites() {
    return this.nginxSiteService.listSites();
  }

  @Post('sites')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  createSite(@Body() dto: CreateNginxSiteDto) {
    return this.nginxSiteService.createSite(dto);
  }

  @Put('sites/:name')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  updateSite(@Param('name') name: string, @Body() dto: CreateNginxSiteDto) {
    return this.nginxSiteService.updateSite(name, dto);
  }

  @Delete('sites/:name')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  deleteSite(@Param('name') name: string) {
    return this.nginxSiteService.deleteSite(name);
  }

  @Post('sites/:name/toggle')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  toggleSite(@Param('name') name: string) {
    return this.nginxSiteService.toggleSite(name);
  }

  @Post('test')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  testConfig() {
    return this.nginxSiteService.testConfig();
  }

  @Post('reload')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  async reloadNginx(@Request() req: JwtRequest) {
    const result = await this.nginxSiteService.reloadNginx();
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
  async getUpstreams() {
    const containers = await this.listContainersUseCase.execute();
    return containers
      .filter((c) => c.liveStatus === 'running')
      .map((c) => {
        const upstreams: Array<{ label: string; value: string }> = [];
        for (const [internal] of Object.entries(c.ports)) {
          upstreams.push({
            label: `${c.name}:${internal}`,
            value: `http://${c.name}:${internal}`,
          });
        }
        return {
          name: c.name,
          image: c.image,
          status: c.liveStatus,
          upstreams,
        };
      });
  }

  // ===== SSL Certificate Endpoints =====

  /**
   * List all SSL certificates
   * GET /nginx/certs
   */
  @Get('certs')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  listCerts() {
    return this.certService.listCerts();
  }

  /**
   * Issue a new SSL certificate
   * POST /nginx/certs/issue
   */
  @Post('certs/issue')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  issueCert(@Body() body: { domain: string; email: string; mode?: string }) {
    if (body.mode === 'standalone') {
      return this.certService.issueCertStandalone(body.domain, body.email);
    }
    return this.certService.issueCert(body.domain, body.email);
  }

  /**
   * Renew all certificates
   * POST /nginx/certs/renew
   */
  @Post('certs/renew')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  async renewCerts(@Request() req: JwtRequest) {
    const result = await this.certService.renewAll();
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

  // ===== DNS Management Endpoints =====

  /**
   * Get public IP of this server
   * GET /nginx/dns/ip
   */
  @Get('dns/ip')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  getPublicIp() {
    return this.dnsService.getPublicIp().then((ip) => ({ ip }));
  }

  /**
   * Verify DNS for a single domain
   * POST /nginx/dns/verify
   */
  @Post('dns/verify')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  verifyDns(@Body() body: { domain: string }) {
    return this.dnsService.verifyDns(body.domain);
  }

  /**
   * Verify DNS for all configured proxy domains
   * GET /nginx/dns/verify-all
   */
  @Get('dns/verify-all')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  async verifyAllDns() {
    const sites = await this.nginxSiteService.listSites();
    const domains = sites.map((s: any) => s.domain);
    return this.dnsService.verifyAll(domains);
  }
}
