import { WORLD_MAP } from './worldMap.generated';

/** 위도·경도를 지도 좌표로. 지도 자료를 만든 것과 같은 등장방형 투영이다. */
export function projectToMap(lat: number, lon: number): [number, number] {
  const scale = WORLD_MAP.width / 360;
  const clamped = Math.max(WORLD_MAP.south, Math.min(WORLD_MAP.north, lat));
  return [(lon + 180) * scale, (WORLD_MAP.north - clamped) * scale];
}

const DOT = { min: 4, max: 14 };

/** 점 반지름(지도 단위) — 넓이가 시도 수에 비례하도록 제곱근으로 키운다 */
export function dotRadius(attempts: number, largest: number): number {
  if (largest <= 0) return DOT.min;
  return (
    DOT.min + (DOT.max - DOT.min) * Math.sqrt(Math.min(1, attempts / largest))
  );
}

export function blockedPercent(blockedIps: number, ips: number): number {
  return ips > 0 ? Math.round((blockedIps / ips) * 100) : 0;
}
