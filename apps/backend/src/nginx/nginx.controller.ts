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
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { NginxService, CreateNginxSiteDto } from './nginx.service';
import { CertbotService } from './certbot.service';
import { DnsService } from './dns.service';
import { ListContainersUseCase } from '../docker/application/use-cases';

@Controller('nginx')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class NginxController {
  constructor(
    private readonly nginxService: NginxService,
    private readonly certbotService: CertbotService,
    private readonly dnsService: DnsService,
    private readonly listContainersUseCase: ListContainersUseCase,
  ) {}

  @Get('sites')
  @RequirePermissions('system:read')
  listSites() {
    return this.nginxService.listSites();
  }

  @Post('sites')
  @RequirePermissions('system:write')
  async createSite(@Body() dto: CreateNginxSiteDto) {
    const site = await this.nginxService.createSite(dto);
    // Auto test + reload
    const testResult = await this.nginxService.testConfig();
    if (testResult.success) {
      await this.nginxService.reloadNginx();
    }
    return { ...site, testResult };
  }

  @Put('sites/:name')
  @RequirePermissions('system:write')
  async updateSite(@Param('name') name: string, @Body() dto: CreateNginxSiteDto) {
    const site = await this.nginxService.updateSite(name, dto);
    // Auto test + reload
    const testResult = await this.nginxService.testConfig();
    if (testResult.success) {
      await this.nginxService.reloadNginx();
    }
    return { ...site, testResult };
  }

  @Delete('sites/:name')
  @RequirePermissions('system:write')
  async deleteSite(@Param('name') name: string) {
    await this.nginxService.deleteSite(name);
    // Auto test + reload
    const testResult = await this.nginxService.testConfig();
    if (testResult.success) {
      await this.nginxService.reloadNginx();
    }
    return { success: true, testResult };
  }

  @Post('sites/:name/toggle')
  @RequirePermissions('system:write')
  async toggleSite(@Param('name') name: string) {
    const result = await this.nginxService.toggleSite(name);
    // Auto test + reload
    const testResult = await this.nginxService.testConfig();
    if (testResult.success) {
      await this.nginxService.reloadNginx();
    }
    return { ...result, testResult };
  }

  @Post('test')
  @RequirePermissions('system:read')
  testConfig() {
    return this.nginxService.testConfig();
  }

  @Post('reload')
  @RequirePermissions('system:write')
  reloadNginx() {
    return this.nginxService.reloadNginx();
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
        // Build upstream options from port mappings
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
    return this.certbotService.listCerts();
  }

  /**
   * Issue a new SSL certificate
   * POST /nginx/certs/issue
   */
  @Post('certs/issue')
  @RequirePermissions('system:write')
  issueCert(@Body() body: { domain: string; email: string; mode?: string }) {
    if (body.mode === 'standalone') {
      return this.certbotService.issueCertStandalone(body.domain, body.email);
    }
    return this.certbotService.issueCert(body.domain, body.email);
  }

  /**
   * Renew all certificates
   * POST /nginx/certs/renew
   */
  @Post('certs/renew')
  @RequirePermissions('system:write')
  renewCerts() {
    return this.certbotService.renewAll();
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
    const sites = await this.nginxService.listSites();
    const domains = sites.map((s: any) => s.domain);
    return this.dnsService.verifyAll(domains);
  }
}
