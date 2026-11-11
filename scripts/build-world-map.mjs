#!/usr/bin/env node
/**
 * 접속 보안 "공격 지도"의 세계 지도 자료를 Natural Earth(공개 도메인) 1:110m 국가 경계에서 만든다.
 * 원본은 저장소에 넣지 않고, 태그를 고정한 주소에서 받아 SHA-256 으로 같은 파일인지 확인한다.
 *
 * node scripts/build-world-map.mjs [--source <ne_110m_admin_0_countries.geojson>]
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_admin_0_countries.geojson';
const SOURCE_SHA256 =
  '6866c877d39cba9c357620878839b336d569f8c662d3cfab4cb1dbe2d39c977f';
const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../apps/frontend/src/features/security/lib/worldMap.generated.ts',
);

// 남극을 뺀 등장방형 투영. 화면에서 IP 위치를 찍을 때도 같은 값을 쓴다.
const WORLD = { north: 84, south: -58, width: 720 };
const scale = WORLD.width / 360;
const projectX = (lon) => (lon + 180) * scale;
const projectY = (lat) =>
  (WORLD.north - Math.max(WORLD.south, Math.min(WORLD.north, lat))) * scale;
const height = Math.round(projectY(WORLD.south));

async function readSource() {
  const index = process.argv.indexOf('--source');
  const raw =
    index === -1
      ? Buffer.from(await (await fetch(SOURCE_URL)).arrayBuffer())
      : fs.readFileSync(process.argv[index + 1]);
  const digest = createHash('sha256').update(raw).digest('hex');
  if (digest !== SOURCE_SHA256) {
    throw new Error(`원본 SHA-256 이 다름: ${digest}`);
  }
  return JSON.parse(raw.toString('utf8'));
}

function ringArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

function segmentDistance([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length
    ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length))
    : 0;
  return (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
}

/** 더글러스-포커 단순화 */
function simplify(points, tolerance) {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const limit = tolerance * tolerance;
  while (stack.length) {
    const [first, last] = stack.pop();
    let farthest = -1;
    let farthestDistance = limit;
    for (let i = first + 1; i < last; i++) {
      const distance = segmentDistance(points[i], points[first], points[last]);
      if (distance > farthestDistance) {
        farthest = i;
        farthestDistance = distance;
      }
    }
    if (farthest === -1) continue;
    keep[farthest] = 1;
    stack.push([first, farthest], [farthest, last]);
  }
  return points.filter((_, i) => keep[i]);
}

const round = (value) => Math.round(value * 10) / 10;

function pathOf(polygons) {
  return polygons
    .flat()
    .map((ring) => ring.map(([lon, lat]) => [projectX(lon), projectY(lat)]))
    .filter((ring) => ringArea(ring) >= 0.6)
    .map((ring) => simplify(ring, 0.35))
    .filter((ring) => ring.length >= 4)
    .map(
      (ring) =>
        `M${ring
          .slice(0, -1)
          .map(([x, y]) => `${round(x)} ${round(y)}`)
          .join('L')}Z`,
    )
    .join('');
}

const source = await readSource();
const countries = {};
let unnamed = '';
for (const { properties, geometry } of source.features) {
  if (properties.ADM0_A3 === 'ATA') continue;
  const polygons =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const d = pathOf(polygons);
  if (!d) continue;
  // 북키프로스·소말릴란드는 ISO 코드가 없어 바탕 땅으로만 그린다
  if (/^[A-Z]{2}$/.test(properties.ISO_A2_EH)) {
    countries[properties.ISO_A2_EH] = d;
  } else {
    unnamed += d;
  }
}
const sorted = Object.fromEntries(
  Object.entries(countries).sort(([a], [b]) => a.localeCompare(b)),
);

const output = `// 자동 생성 파일. scripts/build-world-map.mjs 로 만들고 손으로 고치지 않는다.
// 자료 출처: Natural Earth (https://www.naturalearthdata.com) 공개 도메인, ne_110m_admin_0_countries v5.1.2

export const WORLD_MAP = {
  width: ${WORLD.width},
  height: ${height},
  north: ${WORLD.north},
  south: ${WORLD.south},
  /** ISO 코드가 없는 땅 */
  unnamed: ${JSON.stringify(unnamed)},
} as const;

/** 국가 코드(ISO 3166-1 두 글자)별 경계 경로 */
export const WORLD_COUNTRIES: Readonly<Record<string, string>> = ${JSON.stringify(sorted)};
`;
fs.writeFileSync(OUT, output);
console.log(
  `국가 ${Object.keys(sorted).length}개, ${output.length} bytes, ${path.relative(process.cwd(), OUT)}`,
);
