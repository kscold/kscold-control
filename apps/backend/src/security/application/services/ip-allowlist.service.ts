import { Injectable, Logger } from '@nestjs/common';
import * as net from 'net';

/**
 * IP를 차단해도 되는지 판단한다.
 * 실수로 자기 자신을 잠그거나 내부 트래픽을 차단하는 사고를 막는다.
 */
@Injectable()
export class IpAllowlistService {
  private readonly logger = new Logger(IpAllowlistService.name);

  private readonly defaultAllow: string[] = [
    '127.0.0.0/8',
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
    '::1/128',
    'fc00::/7',
    'fe80::/10',
  ];

  isProtected(
    ip: string,
    requesterIp: string | null,
  ): {
    protected: boolean;
    reason?: string;
  } {
    if (!net.isIP(ip)) {
      return { protected: true, reason: '유효한 IP 주소가 아닙니다.' };
    }

    if (requesterIp && this.isSameIp(ip, requesterIp)) {
      return {
        protected: true,
        reason: '요청자 본인 IP는 차단할 수 없습니다.',
      };
    }

    const ranges = [...this.defaultAllow, ...this.extraAllow()];
    for (const cidr of ranges) {
      if (this.isInCidr(ip, cidr)) {
        return {
          protected: true,
          reason: `${cidr} 대역은 allowlist에 의해 보호됩니다.`,
        };
      }
    }

    return { protected: false };
  }

  private extraAllow(): string[] {
    const raw = process.env.SECURITY_ALLOWLIST;
    if (!raw) return [];
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private isSameIp(a: string, b: string): boolean {
    if (a === b) return true;
    // v4를 v6로 매핑한 형태(::ffff:1.2.3.4) 비교
    const stripA = a.replace(/^::ffff:/, '');
    const stripB = b.replace(/^::ffff:/, '');
    return stripA === stripB;
  }

  private isInCidr(ip: string, cidr: string): boolean {
    const [range, bitsRaw] = cidr.split('/');
    if (!range || !bitsRaw) return false;
    const bits = parseInt(bitsRaw, 10);
    if (Number.isNaN(bits)) return false;

    const v4 = net.isIPv4(range) && net.isIPv4(ip);
    const v6 = net.isIPv6(range) && net.isIPv6(ip);
    if (!v4 && !v6) return false;

    const ipBytes = v4 ? this.v4ToBytes(ip) : this.v6ToBytes(ip);
    const rangeBytes = v4 ? this.v4ToBytes(range) : this.v6ToBytes(range);
    const totalBits = v4 ? 32 : 128;
    if (bits < 0 || bits > totalBits) return false;

    let remaining = bits;
    for (let i = 0; i < ipBytes.length && remaining > 0; i++) {
      const take = Math.min(8, remaining);
      const mask = take === 8 ? 0xff : (0xff << (8 - take)) & 0xff;
      if ((ipBytes[i] & mask) !== (rangeBytes[i] & mask)) return false;
      remaining -= take;
    }
    return true;
  }

  private v4ToBytes(ip: string): number[] {
    return ip.split('.').map((p) => parseInt(p, 10) & 0xff);
  }

  private v6ToBytes(ip: string): number[] {
    // 단순 전개
    const expanded = this.expandV6(ip);
    const bytes: number[] = [];
    for (const group of expanded.split(':')) {
      const v = parseInt(group, 16);
      bytes.push((v >> 8) & 0xff, v & 0xff);
    }
    return bytes;
  }

  private expandV6(ip: string): string {
    if (!ip.includes('::')) return ip;
    const [left, right] = ip.split('::');
    const leftGroups = left ? left.split(':') : [];
    const rightGroups = right ? right.split(':') : [];
    const missing = 8 - leftGroups.length - rightGroups.length;
    return [...leftGroups, ...Array(missing).fill('0'), ...rightGroups].join(
      ':',
    );
  }
}
