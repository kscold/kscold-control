import { createHash, timingSafeEqual } from 'node:crypto';
import { BlockList, isIP } from 'node:net';
import type { IncomingHttpHeaders } from 'node:http';

/** 소켓 주소와 헤더만 읽으므로 Express 요청과 소켓 핸드셰이크 요청을 모두 받는다. */
export interface ClientAddressSource {
  headers: IncomingHttpHeaders;
  socket?: { remoteAddress?: string } | null;
}

export interface ProxyTrust {
  proxies: BlockList;
  secret: string | null;
}

export const PROXY_SECRET_HEADER = 'x-control-proxy-secret';
const LOOPBACK_PROXIES = ['127.0.0.0/8', '::1'];
const MIN_PROXY_SECRET_LENGTH = 32;
/** IPv4 를 담은 IPv6 표기도 45자를 넘지 않는다. 더 긴 값은 저장 칸(varchar 64)을 넘기기 전에 버린다. */
const MAX_IP_INPUT_LENGTH = 64;

/**
 * `CONTROL_TRUSTED_PROXIES`(쉼표로 구분한 IP·CIDR)를 읽는다. 항목이 하나도 없으면 루프백만 믿는다.
 * 잘못된 항목을 건너뛰면 모르는 사이에 위조 헤더를 믿게 되므로 기동을 멈춘다.
 */
export function parseTrustedProxies(raw: string | undefined): BlockList {
  const list = new BlockList();
  const configured = (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  for (const entry of configured.length ? configured : LOOPBACK_PROXIES) {
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

/** 짧은 값은 추측할 수 있으니 기동을 멈춘다. 비우면 null(헤더 확인 안 함). */
export function parseProxySecret(raw: string | undefined): string | null {
  const secret = raw?.trim();
  if (!secret) return null;
  if (secret.length < MIN_PROXY_SECRET_LENGTH) {
    throw new Error(
      `CONTROL_PROXY_SECRET 은 ${MIN_PROXY_SECRET_LENGTH}자 이상이어야 합니다.`,
    );
  }
  return secret;
}

let configured: ProxyTrust | undefined;

export function configuredProxyTrust(): ProxyTrust {
  configured ??= {
    proxies: parseTrustedProxies(process.env.CONTROL_TRUSTED_PROXIES),
    secret: parseProxySecret(process.env.CONTROL_PROXY_SECRET),
  };
  return configured;
}

/** IPv6 에 담긴 IPv4(::ffff:203.0.113.5)는 IPv4 로 펴서 같은 주소가 한 표기로 남게 한다. */
function normalizeIp(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length > MAX_IP_INPUT_LENGTH) return null;
  const withoutZone = trimmed.split('%')[0];
  const mapped = /^::ffff:/i.test(withoutZone) ? withoutZone.slice(7) : null;
  const address = mapped && isIP(mapped) === 4 ? mapped : withoutZone;
  return isIP(address) ? address : null;
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/** 길이가 달라도 같은 시간에 비교하도록 해시끼리 견준다. */
function proxySecretMatches(
  headers: IncomingHttpHeaders,
  secret: string,
): boolean {
  const presented = headers[PROXY_SECRET_HEADER];
  return (
    typeof presented === 'string' &&
    timingSafeEqual(digest(presented), digest(secret))
  );
}

/** 요청을 보낸 사용자의 IP 와, 그 IP 를 프록시 비밀값으로 확인했는지 */
export interface ClientAddress {
  ip: string | null;
  /**
   * 비밀값이 맞는 프록시가 X-Real-IP 로 알려 준 주소일 때만 true 다.
   * 비밀값이 없으면 같은 컴퓨터의 프로세스나 컨테이너도 이 주소를 꾸밀 수 있어, 남의 IP 를 막거나 예외 주소를 사칭하는 데 쓰인다.
   */
  verified: boolean;
}

const resolvedAddresses = new WeakMap<object, ClientAddress>();

/**
 * 요청을 보낸 사용자의 주소.
 * 헤더는 누구나 써 넣을 수 있으므로 소켓 상대가 믿는 프록시이고 프록시 비밀값까지 맞을 때만 X-Real-IP 를 쓴다.
 */
export function clientAddress(
  source: ClientAddressSource,
  trust: ProxyTrust = configuredProxyTrust(),
): ClientAddress {
  const resolved = resolvedAddresses.get(source);
  if (resolved) return resolved;
  const peer = normalizeIp(source.socket?.remoteAddress);
  if (!peer) return { ip: null, verified: false };
  if (
    !trust.proxies.check(peer, isIP(peer) === 4 ? 'ipv4' : 'ipv6') ||
    (trust.secret !== null && !proxySecretMatches(source.headers, trust.secret))
  ) {
    return { ip: peer, verified: false };
  }
  const realIp = source.headers['x-real-ip'];
  const forwarded = typeof realIp === 'string' ? normalizeIp(realIp) : null;
  return forwarded
    ? { ip: forwarded, verified: trust.secret !== null }
    : { ip: peer, verified: false };
}

export function clientIp(
  source: ClientAddressSource,
  trust: ProxyTrust = configuredProxyTrust(),
): string | null {
  return clientAddress(source, trust).ip;
}

/** 뒤의 로깅·감사·오류 보고가 요청 헤더를 통째로 남겨도 비밀값이 새지 않게, IP 를 정해 둔 뒤 헤더를 지운다. */
export function resolveClientIpAndDropProxySecret(
  req: ClientAddressSource,
  _res: unknown,
  next: () => void,
): void {
  resolvedAddresses.set(req, clientAddress(req));
  delete req.headers[PROXY_SECRET_HEADER];
  next();
}
