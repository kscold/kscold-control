import { Injectable } from '@nestjs/common';
import { DnsService } from '../services/dns.service';

@Injectable()
export class GetPublicIpUseCase {
  constructor(private readonly dnsService: DnsService) {}

  async execute() {
    const ip = await this.dnsService.getPublicIp();
    return { ip };
  }
}
