import { Injectable } from '@nestjs/common';
import { DnsService } from '../services/dns.service';

@Injectable()
export class VerifyDnsUseCase {
  constructor(private readonly dnsService: DnsService) {}

  execute(domain: string) {
    return this.dnsService.verifyDns(domain);
  }
}
