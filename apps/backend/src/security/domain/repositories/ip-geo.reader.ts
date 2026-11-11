import { classifySshIp } from '../ssh-audit/ssh-audit.model';

export const IP_GEO_READER = Symbol('IP_GEO_READER');

/** IP 한 개의 위치. DB-IP City Lite 의 도시 단위 값이다. */
export interface IpGeo {
  /** ISO 3166-1 두 글자 */
  country: string;
  countryName: string;
  city: string | null;
  lat: number;
  lon: number;
}

/**
 * off: 경로를 안 줌, loading: 기동 중 파일을 읽는 중,
 * unavailable: 파일이 없거나 깨짐, ready: 조회 가능
 */
export type IpGeoStatus =
  | { state: 'off' }
  | { state: 'loading' }
  | { state: 'unavailable' }
  | { state: 'ready'; builtAt: string };

export interface IIpGeoReader {
  status(): IpGeoStatus;
  /** 찾지 못했거나 조회할 수 없으면 null */
  lookup(ip: string): IpGeo | null;
}

/** 외부 주소만 찾는다. 대역(CIDR)은 시작 주소로 찾는다. */
export function externalGeo(reader: IIpGeoReader, value: string): IpGeo | null {
  const ip = value.split('/')[0];
  return classifySshIp(ip) === 'external' ? reader.lookup(ip) : null;
}
