import { Injectable, Logger } from '@nestjs/common';
import {
  parseIpRange,
  rangeContains,
  rangesOverlap,
  type IpFamily,
  type IpRange,
} from '../../domain/ip-range';

const PRIVATE_RANGES = [
  '127.0.0.0/8',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '::1/128',
  'fc00::/7',
  'fe80::/10',
].map((cidr) => parseIpRange(cidr) as IpRange);

/** 이보다 넓은 대역은 차단에서 보호만 하고 로그인 예외로는 쓰지 않는다. */
const MIN_LOGIN_EXEMPT_PREFIX: Record<IpFamily, number> = {
  ipv4: 16,
  ipv6: 48,
};

/** 잘못 적은 항목을 건너뛰면 모르는 사이에 보호·예외 범위가 바뀌므로 기동을 멈춘다. */
export function parseSecurityAllowlist(raw: string | undefined): IpRange[] {
  return (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const range = parseIpRange(entry);
      if (!range) {
        throw new Error(`SECURITY_ALLOWLIST 항목을 읽을 수 없습니다: ${entry}`);
      }
      return range;
    });
}

/**
 * IP를 차단해도 되는지 판단한다.
 * 실수로 자기 자신을 잠그거나 내부 트래픽을 차단하는 사고를 막는다.
 */
@Injectable()
export class IpAllowlistService {
  private readonly logger = new Logger(IpAllowlistService.name);
  private readonly listed = parseSecurityAllowlist(
    process.env.SECURITY_ALLOWLIST,
  );
  private readonly loginExempt = this.listed.filter(
    (range) => range.prefix >= MIN_LOGIN_EXEMPT_PREFIX[range.family],
  );

  constructor() {
    for (const range of this.listed) {
      if (!this.loginExempt.includes(range)) {
        this.logger.warn(
          `SECURITY_ALLOWLIST 의 ${range.label} 은 넓어서 차단에서 보호만 하고 로그인 예외로는 쓰지 않습니다.`,
        );
      }
    }
  }

  /** 대상은 IP 하나나 대역(IPv6 /64 로그인 차단)이다. 보호 대역과 겹치면 막지 않는다. */
  isProtected(
    target: string,
    requesterIp: string | null,
  ): {
    protected: boolean;
    reason?: string;
  } {
    const range = parseIpRange(target);
    if (!range) {
      return { protected: true, reason: '유효한 IP 주소가 아닙니다.' };
    }

    if (requesterIp && this.isSameIp(target, requesterIp)) {
      return {
        protected: true,
        reason: '요청자 본인 IP는 차단할 수 없습니다.',
      };
    }

    const hit = [...PRIVATE_RANGES, ...this.listed].find((allowed) =>
      rangesOverlap(allowed, range),
    );
    if (hit) {
      return {
        protected: true,
        reason: `${hit.label} 대역은 allowlist에 의해 보호됩니다.`,
      };
    }

    return { protected: false };
  }

  /** 운영자가 SECURITY_ALLOWLIST 에 적은 좁은 대역 안의 주소인가. 기본 내부 대역은 여기에 들지 않는다. */
  isListed(ip: string): boolean {
    return this.loginExempt.some((range) => rangeContains(range, ip));
  }

  /** 루프백·사설망처럼 기본으로 보호하는 대역 안의 주소인가 */
  isPrivate(ip: string): boolean {
    return PRIVATE_RANGES.some((range) => rangeContains(range, ip));
  }

  private isSameIp(a: string, b: string): boolean {
    if (a === b) return true;
    // v4를 v6로 매핑한 형태(::ffff:1.2.3.4) 비교
    const stripA = a.replace(/^::ffff:/, '');
    const stripB = b.replace(/^::ffff:/, '');
    return stripA === stripB;
  }
}
