import { BlockList, isIP } from 'node:net';

export type IpFamily = 'ipv4' | 'ipv6';

/** 주소 하나(접두 길이를 다 채운 대역)나 CIDR 대역 */
export interface IpRange {
  /** 적힌 그대로의 값 */
  label: string;
  /** 적힌 주소. 대역 밖 비트가 섞여 있어도 이 대역 안의 주소다. */
  address: string;
  prefix: number;
  family: IpFamily;
  list: BlockList;
}

/**
 * 'IP' 또는 'IP/접두 길이' 를 읽는다. 읽을 수 없으면 null.
 * 접두 길이는 10진수만 받는다. parseInt 처럼 읽으면 '/0x10'·'/00' 이 /0 이 되어 모든 주소가 들어간다.
 */
export function parseIpRange(value: string): IpRange | null {
  const label = value.trim();
  const [address, prefix, ...rest] = label.split('/');
  const version = isIP(address);
  if (!version || rest.length > 0) return null;
  const family: IpFamily = version === 4 ? 'ipv4' : 'ipv6';
  const max = version === 4 ? 32 : 128;
  if (prefix !== undefined && !/^(0|[1-9]\d{0,2})$/.test(prefix)) return null;
  const bits = prefix === undefined ? max : Number(prefix);
  if (bits > max) return null;
  const list = new BlockList();
  list.addSubnet(address, bits, family);
  return { label, address, prefix: bits, family, list };
}

export function rangeContains(range: IpRange, ip: string): boolean {
  const version = isIP(ip);
  return version !== 0 && range.list.check(ip, version === 4 ? 'ipv4' : 'ipv6');
}

/** CIDR 대역은 겹치면 한쪽이 다른 쪽을 품으므로, 서로의 주소가 상대 안에 있는지만 보면 된다. */
export function rangesOverlap(a: IpRange, b: IpRange): boolean {
  return (
    a.family === b.family &&
    (a.list.check(b.address, b.family) || b.list.check(a.address, a.family))
  );
}
