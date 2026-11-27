import { Injectable } from '@nestjs/common';
import { exec } from 'node:child_process';
import { resolve4, resolveCname } from 'node:dns/promises';
import { promisify } from 'node:util';
import type { IDnsLookupGateway } from '../../domain/gateways/dns-lookup.gateway.interface';

const execAsync = promisify(exec);
const commands = {
  ipify: 'curl -s https://api.ipify.org',
  ifconfig: 'curl -s https://ifconfig.me',
};

@Injectable()
export class NodeDnsLookupGateway implements IDnsLookupGateway {
  async lookupPublicIp(provider: 'ipify' | 'ifconfig'): Promise<string> {
    const { stdout } = await execAsync(commands[provider], { timeout: 10000 });
    return stdout.trim();
  }

  resolveAddresses(domain: string): Promise<string[]> {
    return resolve4(domain);
  }

  resolveAliases(domain: string): Promise<string[]> {
    return resolveCname(domain);
  }
}
