import { Injectable } from '@nestjs/common';
import { DnsService } from '../services/dns.service';
import { NginxSiteService } from '../services/nginx-site.service';

@Injectable()
export class VerifyAllDnsUseCase {
  constructor(
    private readonly dnsService: DnsService,
    private readonly nginxSiteService: NginxSiteService,
  ) {}

  async execute() {
    const sites = await this.nginxSiteService.listSites();
    const domains = sites.map((s) => s.domain);
    return this.dnsService.verifyAll(domains);
  }
}
