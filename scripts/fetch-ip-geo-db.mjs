#!/usr/bin/env node
/**
 * 공격 지도에 쓰는 DB-IP City Lite(CC BY 4.0) 파일을 내려받아 설치한다.
 * 임시 파일로 받고 검사를 통과해야 바꾸므로, 실패하면 기존 파일이 그대로 남는다.
 * Control 은 기동할 때 파일을 읽으므로 바꾼 뒤 다시 시작해야 새 판을 쓴다.
 *
 * node scripts/fetch-ip-geo-db.mjs --out /absolute/path/dbip-city-lite.mmdb [--month 2026-11]
 * --out 을 빼면 CONTROL_IP_GEO_DB_PATH 를 쓴다.
 */
import { createWriteStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';

const MAX_DOWNLOAD_MS = 10 * 60_000;
const MIN_BYTES = 10_000_000;
// MaxMind DB 형식의 메타데이터 시작 표시. 파일 끝 128KiB 안에 있어야 한다.
const METADATA_MARKER = Buffer.from('abcdef4d61784d696e642e636f6d', 'hex');
const METADATA_WINDOW = 128 * 1024;

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const monthOf = (date) => date.toISOString().slice(0, 7);

/** 이달 판이 아직 안 올라왔을 수 있어 지난달도 후보로 둔다 */
function candidateMonths(now) {
  return [
    monthOf(now),
    monthOf(
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15)),
    ),
  ];
}

async function download(month, target) {
  const url = `https://download.db-ip.com/free/dbip-city-lite-${month}.mmdb.gz`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(MAX_DOWNLOAD_MS),
  });
  if (!response.ok || !response.body) {
    throw new Error(`${month} 내려받기 실패: HTTP ${response.status}`);
  }
  await pipeline(
    Readable.fromWeb(response.body),
    createGunzip(),
    createWriteStream(target, { mode: 0o644 }),
  );
}

async function assertMmdb(file) {
  const { size } = await fs.stat(file);
  if (size < MIN_BYTES) throw new Error(`파일이 너무 작음: ${size} bytes`);
  const handle = await fs.open(file, 'r');
  try {
    const tail = Buffer.alloc(Math.min(METADATA_WINDOW, size));
    await handle.read(tail, 0, tail.length, size - tail.length);
    if (!tail.includes(METADATA_MARKER)) {
      throw new Error('MaxMind DB 형식이 아님');
    }
  } finally {
    await handle.close();
  }
  return size;
}

async function main() {
  const out = option('--out') ?? process.env.CONTROL_IP_GEO_DB_PATH;
  if (!out || !path.isAbsolute(out)) {
    throw new Error('--out 이나 CONTROL_IP_GEO_DB_PATH 에 절대 경로가 필요함');
  }
  await fs.mkdir(path.dirname(out), { recursive: true });
  const temporary = `${out}.${process.pid}.tmp`;
  const months = option('--month')
    ? [option('--month')]
    : candidateMonths(new Date());
  try {
    let lastError;
    for (const month of months) {
      try {
        await download(month, temporary);
        const size = await assertMmdb(temporary);
        await fs.rename(temporary, out);
        console.log(`설치함: ${month} 판, ${size} bytes, ${out}`);
        console.log('Control 을 다시 시작하면 새 파일을 읽음');
        return;
      } catch (error) {
        lastError = error;
        console.error(
          `${month}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    throw lastError ?? new Error('내려받을 판이 없음');
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
