import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as dns from 'dns';
import type {
  DnsRecord,
  DnsCheckResult,
} from '../../domain/types/nginx-site.type';

const execAsync = promisify(exec);
const dnsResolve4 = promisify(dns.resolve4);
const dnsResolveCname = promisify(dns.resolveCname);

@Injectable()
export class DnsService {
  private readonly logger = new Logger(DnsService.name);
  private cachedPublicIp: string | null = null;
  private ipCacheTime = 0;

  /**
   * Get the public IP address of this server
   */
  async getPublicIp(): Promise<string> {
    // Cache for 5 minutes
    if (this.cachedPublicIp && Date.now() - this.ipCacheTime < 300000) {
      return this.cachedPublicIp;
    }

    try {
      const { stdout } = await execAsync('curl -s https://api.ipify.org', {
        timeout: 10000,
      });
      this.cachedPublicIp = stdout.trim();
      this.ipCacheTime = Date.now();
      return this.cachedPublicIp;
    } catch {
      try {
        const { stdout } = await execAsync('curl -s https://ifconfig.me', {
          timeout: 10000,
        });
        this.cachedPublicIp = stdout.trim();
        this.ipCacheTime = Date.now();
        return this.cachedPublicIp;
      } catch {
        return 'unknown';
      }
    }
  }

  /**
   * Generate required DNS records for a domain
   */
  async getRequiredRecords(domain: string): Promise<DnsRecord[]> {
    const publicIp = await this.getPublicIp();
    const parts = domain.split('.');

    const records: DnsRecord[] = [];

    if (parts.length > 2) {
      const subdomain = parts.slice(0, -2).join('.');
      records.push({
        type: 'A',
        host: subdomain,
        value: publicIp,
        status: 'missing',
      });
    } else {
      records.push({
        type: 'A',
        host: '@',
        value: publicIp,
        status: 'missing',
      });
    }

    return records;
  }

  /**
   * Verify DNS records for a domain
   */
  async verifyDns(domain: string): Promise<DnsCheckResult> {
    const publicIp = await this.getPublicIp();
    const records = await this.getRequiredRecords(domain);

    for (const record of records) {
      try {
        if (record.type === 'A') {
          // CNAME 우선 감지 (예: congbang.kscold.com → kscold.iptime.org)
          let cnameTarget: string | null = null;
          try {
            const cnames = await dnsResolveCname(domain);
            if (cnames.length > 0) cnameTarget = cnames[0];
          } catch {
            /* CNAME 없음 */
          }

          if (cnameTarget !== null) {
            record.type = 'CNAME';
            record.value = cnameTarget;
            try {
              const addresses = await dnsResolve4(domain);
              record.actual = addresses[0] || '';
              record.status = addresses.includes(publicIp) ? 'ok' : 'mismatch';
            } catch {
              record.actual = 'IP 미해석';
              record.status = 'mismatch';
            }
          } else {
            const addresses = await dnsResolve4(domain);
            record.actual = addresses.join(', ');
            if (addresses.includes(publicIp)) {
              record.status = 'ok';
            } else if (addresses.length > 0) {
              record.status = 'mismatch';
            } else {
              record.status = 'missing';
            }
          }
        } else if (record.type === 'CNAME') {
          const cnames = await dnsResolveCname(domain);
          record.actual = cnames.join(', ');
          if (cnames.includes(record.value)) {
            record.status = 'ok';
          } else if (cnames.length > 0) {
            record.status = 'mismatch';
          } else {
            record.status = 'missing';
          }
        }
      } catch {
        record.status = 'missing';
        record.actual = undefined;
      }
    }

    return {
      domain,
      publicIp,
      records,
      allOk: records.every((r) => r.status === 'ok'),
    };
  }

  /**
   * Verify DNS for multiple domains at once
   */
  async verifyAll(domains: string[]): Promise<DnsCheckResult[]> {
    return Promise.all(domains.map((d) => this.verifyDns(d)));
  }
}
