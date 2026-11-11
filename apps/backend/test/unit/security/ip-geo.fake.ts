import type {
  IIpGeoReader,
  IpGeo,
  IpGeoStatus,
} from '@/security/domain/repositories/ip-geo.reader';

/** 표에 적은 IP 만 찾는 위치 조회기. 표를 안 주면 꺼진 상태다. */
export function fakeIpGeo(table?: Record<string, IpGeo>): IIpGeoReader {
  const status: IpGeoStatus = table
    ? { state: 'ready', builtAt: '2026-11-01T00:00:00.000Z' }
    : { state: 'off' };
  return {
    status: () => status,
    lookup: (ip) => table?.[ip] ?? null,
  };
}

export const geo = (
  country: string,
  countryName: string,
  city: string | null = null,
): IpGeo => ({ country, countryName, city, lat: 10, lon: 20 });
