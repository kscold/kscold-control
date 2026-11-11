import { BlockList, isIP } from 'node:net';
import type { IncomingHttpHeaders } from 'node:http';

/** 소켓 주소와 헤더만 읽으므로 Express 요청과 소켓 핸드셰이크 요청을 모두 받는다. */
export interface ClientAddressSource {
  headers: IncomingHttpHeaders;
  socket?: { remoteAddress?: string } | null;
}

const LOOPBACK_PROXIES = '127.0.0.0/8,::1';

/**
 * `CONTROL_TRUSTED_PROXIES`(쉼표로 구분한 IP·CIDR)를 읽는다. 비어 있으면 루프백만 믿는다.
 * 잘못된 항목을 건너뛰면 모르는 사이에 위조 헤더를 믿게 되므로 기동을 멈춘다.
 */
export function parseTrustedProxies(raw: string | undefined): BlockList {
  const list = new BlockList();
  const entries = (raw?.trim() || LOOPBACK_PROXIES)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  for (const entry of entries) {
    const [address, prefix, ...rest] = entry.split('/');
    const family = isIP(address);
    const type = family === 4 ? 'ipv4' : 'ipv6';
    const bits = prefix === undefined ? null : Number(prefix);
    if (
      !family ||
      rest.length > 0 ||
      (bits !== null &&
        (!/^\d{1,3}$/.test(prefix) || bits > (family === 4 ? 32 : 128)))
    ) {
      throw new Error(
        `CONTROL_TRUSTED_PROXIES 항목을 읽을 수 없습니다: ${entry}`,
      );
    }
    if (bits === null) list.addAddress(address, type);
    else list.addSubnet(address, bits, type);
  }
  return list;
}

let configuredProxies: BlockList | undefined;

export function configuredTrustedProxies(): BlockList {
  configuredProxies ??= parseTrustedProxies(
    process.env.CONTROL_TRUSTED_PROXIES,
  );
  return configuredProxies;
}

/** IPv6 에 담긴 IPv4(::ffff:203.0.113.5)는 IPv4 로 펴서 같은 주소가 한 표기로 남게 한다. */
function normalizeIp(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const mapped = /^::ffff:/i.test(trimmed) ? trimmed.slice(7) : null;
  const address = mapped && isIP(mapped) === 4 ? mapped : trimmed;
  return isIP(address) ? address : null;
}

/**
 * 요청을 보낸 사용자의 IP.
 * 헤더는 누구나 써 넣을 수 있으므로 소켓 상대가 믿는 프록시일 때만 X-Real-IP 를 쓴다.
 */
export function clientIp(
  source: ClientAddressSource,
  trustedProxies: BlockList = configuredTrustedProxies(),
): string | null {
  const peer = normalizeIp(source.socket?.remoteAddress);
  if (!peer) return null;
  if (!trustedProxies.check(peer, isIP(peer) === 4 ? 'ipv4' : 'ipv6')) {
    return peer;
  }
  const realIp = source.headers['x-real-ip'];
  return (typeof realIp === 'string' ? normalizeIp(realIp) : null) ?? peer;
}
