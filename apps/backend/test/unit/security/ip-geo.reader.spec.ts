import { Logger } from '@nestjs/common';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CityResponse } from 'mmdb-lib';
import {
  IpGeoReaderImpl,
  toIpGeo,
} from '@/security/infrastructure/readers/ip-geo.reader.impl';

const record = (value: unknown) => value as CityResponse;

describe('IP 위치 파일 한 줄 해석', () => {
  it('한국어 이름이 있으면 한국어로, 없으면 영어로 둔다', () => {
    expect(
      toIpGeo(
        record({
          country: {
            iso_code: 'NL',
            names: { en: 'Netherlands', ko: '네덜란드' },
          },
          city: { names: { en: 'Amsterdam' } },
          location: { latitude: 52.37, longitude: 4.89 },
        }),
      ),
    ).toEqual({
      country: 'NL',
      countryName: '네덜란드',
      city: 'Amsterdam',
      lat: 52.37,
      lon: 4.89,
    });
  });

  it('나라 코드나 좌표가 없으면 위치를 모르는 것으로 본다', () => {
    expect(toIpGeo(null)).toBeNull();
    expect(
      toIpGeo(record({ country: { iso_code: 'US' }, location: {} })),
    ).toBeNull();
    expect(
      toIpGeo(
        record({
          country: { iso_code: '$x' },
          location: { latitude: 1, longitude: 2 },
        }),
      ),
    ).toBeNull();
  });
});

describe('IP 위치 파일을 못 읽을 때', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('경로가 없으면 꺼진 상태다', async () => {
    const reader = new IpGeoReaderImpl(undefined);
    await reader.load();
    expect(reader.status()).toEqual({ state: 'off' });
    expect(reader.lookup('203.0.113.1')).toBeNull();
  });

  it('파일이 없거나 깨져도 예외 없이 쓸 수 없음으로 바뀐다', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'ip-geo-'));
    const broken = join(folder, 'broken.mmdb');
    writeFileSync(broken, 'not a database');
    try {
      for (const path of [join(folder, 'missing.mmdb'), broken]) {
        const reader = new IpGeoReaderImpl(path);
        expect(reader.status()).toEqual({ state: 'loading' });
        await expect(reader.load()).resolves.toBeUndefined();
        expect(reader.status()).toEqual({ state: 'unavailable' });
        expect(reader.lookup('203.0.113.1')).toBeNull();
      }
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
