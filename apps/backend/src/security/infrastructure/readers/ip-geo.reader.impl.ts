import { Logger, type OnModuleInit } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { Reader, type CityResponse } from 'mmdb-lib';
import type {
  IIpGeoReader,
  IpGeo,
  IpGeoStatus,
} from '../../domain/repositories/ip-geo.reader';

/** 빈 값이면 공격 지도를 끈다 */
export function ipGeoReaderFromEnv(): IpGeoReaderImpl {
  return new IpGeoReaderImpl(
    process.env.CONTROL_IP_GEO_DB_PATH?.trim() || undefined,
  );
}

/** 파일 DB 한 줄을 화면에 쓸 값으로 줄인다. 나라나 좌표가 없으면 null */
export function toIpGeo(record: CityResponse | null | undefined): IpGeo | null {
  const code = record?.country?.iso_code;
  const lat = record?.location?.latitude;
  const lon = record?.location?.longitude;
  if (typeof code !== 'string' || !/^[A-Z]{2}$/.test(code)) return null;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  const names = record?.country?.names as Record<string, string> | undefined;
  const cityNames = record?.city?.names as Record<string, string> | undefined;
  return {
    country: code,
    countryName: names?.ko ?? names?.en ?? code,
    city: cityNames?.ko ?? cityNames?.en ?? null,
    lat,
    lon,
  };
}

/**
 * IP 위치를 맥 안의 파일 DB 에서만 찾는다. 외부 API 로 IP 를 보내지 않는다.
 * 경로가 없거나 파일을 못 읽으면 지도만 꺼지고 Control 기동과 다른 화면에는 영향이 없다.
 * 파일(약 130MB)을 통째로 메모리에 올린다.
 */
export class IpGeoReaderImpl implements IIpGeoReader, OnModuleInit {
  private readonly logger = new Logger('IpGeo');
  private reader: Reader<CityResponse> | null = null;
  private current: IpGeoStatus;

  constructor(private readonly path: string | undefined) {
    this.current = path ? { state: 'loading' } : { state: 'off' };
  }

  onModuleInit() {
    // 큰 파일을 읽는 동안 기동을 붙잡지 않는다
    void this.load();
  }

  async load(): Promise<void> {
    if (!this.path) return;
    try {
      const reader = new Reader<CityResponse>(await readFile(this.path));
      this.reader = reader;
      this.current = {
        state: 'ready',
        builtAt: new Date(reader.metadata.buildEpoch).toISOString(),
      };
    } catch (error) {
      this.reader = null;
      this.current = { state: 'unavailable' };
      this.logger.warn(
        `IP 위치 파일을 읽지 못해 공격 지도를 끕니다: ${String(error)}`,
      );
    }
  }

  status(): IpGeoStatus {
    return this.current;
  }

  lookup(ip: string): IpGeo | null {
    if (!this.reader) return null;
    try {
      return toIpGeo(this.reader.get(ip));
    } catch {
      return null;
    }
  }
}
