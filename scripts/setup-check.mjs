#!/usr/bin/env node
/**
 * 설치 상태 점검: 사람이든 AI 에이전트든 이 출력만 보고 다음에 할 일을 알 수 있게 한다.
 *   pnpm setup:check              점검만
 *   pnpm setup:check --secrets    .env 에 넣을 새 비밀값을 만들어 보여 줌(파일은 건드리지 않음)
 * 하나라도 ✗ 이면 1 로 끝난다.
 */
import { existsSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

if (process.argv.includes('--secrets')) {
  console.log('# .env 에 붙여 넣을 새 값 (한 번 정하면 바꾸지 말 것: MFA·KEY 값을 바꾸면 기존 데이터를 못 읽음)');
  console.log(`JWT_SECRET=${randomBytes(48).toString('base64url')}`);
  console.log(`CONTROL_MFA_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}`);
  console.log(`KEY_MANAGEMENT_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}`);
  console.log(`INFRA_DB_PASSWORD=${randomBytes(18).toString('base64url')}`);
  process.exit(0);
}

const results = [];
const check = (ok, label, fix) => results.push({ ok, label, fix });

function parseEnv(file) {
  const env = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return env;
}

// 1. Node·pnpm
const nodeMajor = Number(process.versions.node.split('.')[0]);
check(nodeMajor >= 22, `Node ${process.versions.node}`, 'Node 22 이상을 설치하세요 (nvm install 24).');
let pnpmVersion = null;
try {
  pnpmVersion = execFileSync('pnpm', ['--version'], { encoding: 'utf8' }).trim();
} catch {
  // 아래에서 ✗ 로 알린다
}
check(Boolean(pnpmVersion), `pnpm ${pnpmVersion ?? '없음'}`, 'corepack enable && corepack prepare pnpm@latest --activate');
check(existsSync(path.join(root, 'node_modules')), '의존성 설치', '저장소 루트에서 pnpm install');

// 2. .env
const envFile = path.join(root, '.env');
const hasEnv = existsSync(envFile);
check(hasEnv, '.env 파일', 'cp .env.example .env 후 아래 ✗ 항목을 채우세요.');
const env = hasEnv ? { ...parseEnv(envFile), ...process.env } : process.env;

const placeholder = (v) => !v || /change-me|replace-with|change-this|example\.com/i.test(v);
check(!placeholder(env.DATABASE_URL), 'DATABASE_URL', 'PostgreSQL 주소를 넣으세요. 예: postgresql://user:pass@localhost:5432/control');
check((env.JWT_SECRET ?? '').length >= 32 && !placeholder(env.JWT_SECRET), 'JWT_SECRET (32자 이상)', 'pnpm setup:check --secrets 로 만든 값을 넣으세요.');
for (const key of ['CONTROL_MFA_ENCRYPTION_KEY', 'KEY_MANAGEMENT_ENCRYPTION_KEY']) {
  let ok = false;
  try {
    ok = Buffer.from(env[key] ?? '', 'base64').length === 32;
  } catch {
    ok = false;
  }
  check(ok, `${key} (base64 32바이트)`, 'pnpm setup:check --secrets 로 만든 값을 넣으세요. 한 번 정하면 바꾸지 마세요.');
}
check(!placeholder(env.ADMIN_PASSWORD) || env.SEED_ADMIN_BOOTSTRAP !== 'true', '첫 관리자 비밀번호', 'SEED_ADMIN_BOOTSTRAP=true 일 때는 ADMIN_EMAIL·ADMIN_PASSWORD 를 실제 값으로 바꾸세요.');

// 3. 데이터베이스 포트에 닿는지
async function reachable(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: 3000 }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}
if (!placeholder(env.DATABASE_URL)) {
  try {
    const url = new URL(env.DATABASE_URL);
    const ok = await reachable(url.hostname, Number(url.port || 5432));
    check(ok, `DB 연결 ${url.hostname}:${url.port || 5432}`, 'PostgreSQL 이 떠 있는지 확인하세요 (예: docker compose up -d postgres).');
  } catch {
    check(false, 'DATABASE_URL 형식', 'postgresql://user:pass@host:5432/db 형식인지 확인하세요.');
  }
}

// 4. Docker
let dockerOk = false;
try {
  execFileSync('docker', ['info', '--format', '{{.ServerVersion}}'], {
    stdio: 'pipe',
    env: { ...process.env, ...(env.DOCKER_HOST ? { DOCKER_HOST: env.DOCKER_HOST } : {}) },
    timeout: 8000,
  });
  dockerOk = true;
} catch {
  // 아래에서 ✗ 로 알린다
}
check(dockerOk, 'Docker 연결', 'Docker(또는 Colima)를 켜고, 소켓이 기본 위치가 아니면 .env 의 DOCKER_HOST 를 맞추세요.');

// 5. 빌드 결과
check(existsSync(path.join(root, 'apps/backend/dist/main.js')), '백엔드 빌드', 'pnpm build');

let failed = 0;
for (const r of results) {
  console.log(`${r.ok ? '✓' : '✗'} ${r.label}`);
  if (!r.ok) {
    failed += 1;
    console.log(`    → ${r.fix}`);
  }
}
console.log(
  failed
    ? `\n${failed}개 남음. 위 → 를 위에서부터 하나씩 하고 pnpm setup:check 를 다시 실행하세요.`
    : '\n모두 준비됨. pnpm migrate:database → pnpm deploy:production (또는 pnpm dev) 순서로 진행하세요.',
);
process.exit(failed ? 1 : 0);
