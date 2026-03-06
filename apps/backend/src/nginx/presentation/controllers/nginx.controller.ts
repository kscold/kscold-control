import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { NginxSiteService } from '../../application/services/nginx-site.service';
import { CertService } from '../../application/services/cert.service';
import { DnsService } from '../../application/services/dns.service';
import { ListContainersUseCase } from '../../../docker/application/use-cases';
import type { CreateNginxSiteDto } from '../../domain/types/nginx-site.type';

@Controller('nginx')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class NginxController {
  constructor(
    private readonly nginxSiteService: NginxSiteService,
    private readonly certService: CertService,
    private readonly dnsService: DnsService,
    private readonly listContainersUseCase: ListContainersUseCase,
  ) {}

  @Get('sites')
  @RequirePermissions('system:read')
  listSites() {
    return this.nginxSiteService.listSites();
  }

  @Post('sites')
  @RequirePermissions('system:write')
  createSite(@Body() dto: CreateNginxSiteDto) {
    return this.nginxSiteService.createSite(dto);
  }

  @Put('sites/:name')
  @RequirePermissions('system:write')
  updateSite(@Param('name') name: string, @Body() dto: CreateNginxSiteDto) {
    return this.nginxSiteService.updateSite(name, dto);
  }

  @Delete('sites/:name')
  @RequirePermissions('system:write')
  deleteSite(@Param('name') name: string) {
    return this.nginxSiteService.deleteSite(name);
  }

  @Post('sites/:name/toggle')
  @RequirePermissions('system:write')
  toggleSite(@Param('name') name: string) {
    return this.nginxSiteService.toggleSite(name);
  }

  @Post('test')
  @RequirePermissions('system:read')
  testConfig() {
    return this.nginxSiteService.testConfig();
  }

  @Post('reload')
  @RequirePermissions('system:write')
  reloadNginx() {
    return this.nginxSiteService.reloadNginx();
  }

  /**
   * Get available container upstreams for proxy configuration
   * Returns running containers with their internal ports
   */
  @Get('upstreams')
  @RequirePermissions('system:read')
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
  @RequirePermissions('system:read')
  listCerts() {
    return this.certService.listCerts();
  }

  /**
   * Issue a new SSL certificate
   * POST /nginx/certs/issue
   */
  @Post('certs/issue')
  @RequirePermissions('system:write')
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
  @RequirePermissions('system:write')
  renewCerts() {
    return this.certService.renewAll();
  }

  // ===== DNS Management Endpoints =====

  /**
   * Get public IP of this server
   * GET /nginx/dns/ip
   */
  @Get('dns/ip')
  @RequirePermissions('system:read')
  getPublicIp() {
    return this.dnsService.getPublicIp().then((ip) => ({ ip }));
  }

  /**
   * Verify DNS for a single domain
   * POST /nginx/dns/verify
   */
  @Post('dns/verify')
  @RequirePermissions('system:read')
  verifyDns(@Body() body: { domain: string }) {
    return this.dnsService.verifyDns(body.domain);
  }

  /**
   * Verify DNS for all configured proxy domains
   * GET /nginx/dns/verify-all
   */
  @Get('dns/verify-all')
  @RequirePermissions('system:read')
  async verifyAllDns() {
    const sites = await this.nginxSiteService.listSites();
    const domains = sites.map((s: any) => s.domain);
    return this.dnsService.verifyAll(domains);
  }
}
