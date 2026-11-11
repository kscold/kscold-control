import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = execFileSync('git', ['ls-files', '-z'], {
  cwd: root,
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean);
const violations = [];
for (const file of files) {
  const basename = path.posix.basename(file);
  if (
    (/^\.env(?:\.|$)/.test(basename) && !basename.endsWith('.example')) ||
    /^(?:ssl|certbot-config|runtime|\.control-install)\//.test(file) ||
    (/^nginx\/conf\.d\/.+\.conf(?:\.|$)/.test(file) &&
      !file.endsWith('.example')) ||
    /\.(?:pem|key)$/.test(file) ||
    /^(?:docker-compose(?:\.local|\.override)?\.yml|issue-ssl-.+\.sh|setup-ssl\.sh)$/.test(
      file,
    )
  ) {
    violations.push(`${file}: 로컬 운영 파일은 공개 추적할 수 없음`);
  }
  if (
    /apps\/backend\/migrations\/.*(?:key-management-targets|user-key-management-targets)\.sql$/.test(
      file,
    ) &&
    /\bINSERT\s+INTO\b/i.test(readFileSync(path.join(root, file), 'utf8'))
  ) {
    violations.push(
      `${file}: 운영 대상과 개인 계정 시드는 공개 마이그레이션에 넣지 않음`,
    );
  }
}

// ---- 운영 환경을 특정하는 값 검사 ----
// 공개 저장소라 실제 IP·MAC·도메인·계정 이름 같은 값은 코드·테스트·문서에 넣지 않고 .env 로만 받는다.
// --staged: 커밋하려는 변경의 추가된 줄만 검사 (pre-commit 훅). 기존 코드는 막지 않는다.
// 로컬 금지어: <git 공통 폴더>/public-source-denylist 에 한 줄씩 (커밋되지 않음, 작업트리끼리 공유)
const ALLOW_MARK = 'public-source-allow';
const SKIP_FILE =
  /(?:^|\/)(?:pnpm-lock\.yaml|package-lock\.json|CHANGELOG\.md)$|^vendor\//;
const TEST_FILE = /(?:\.spec\.|\.test\.|(?:^|\/)tests?\/)/;

function isDocOrLocalIpv4(ip) {
  const [a, b, c] = ip.split('.').map(Number);
  return (
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a === 127 ||
    ip === '0.0.0.0' ||
    ip === '255.255.255.255'
  );
}

function isPrivateIpv4(ip) {
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254)
  );
}

function loadDenylist() {
  try {
    const common = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
    const file = path.resolve(root, common, 'public-source-denylist');
    return readFileSync(file, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
  } catch {
    return [];
  }
}

export function findSensitive(file, line, denylist) {
  if (SKIP_FILE.test(file) || line.includes(ALLOW_MARK)) return [];
  const found = [];
  const lower = line.toLowerCase();
  for (const word of denylist) {
    if (lower.includes(word.toLowerCase())) found.push(`운영 값 "${word}"`);
  }
  for (const m of line.matchAll(
    /(?<![\w.])(\d{1,3}(?:\.\d{1,3}){3})(?![\w.]|\/\d)/g,
  )) {
    const ip = m[1];
    if (ip.split('.').some((n) => Number(n) > 255)) continue;
    if (isDocOrLocalIpv4(ip)) continue;
    // 사설 주소는 테스트에서만 허용 (실제 집·회사 내부 주소는 금지어로 막음)
    if (isPrivateIpv4(ip) && TEST_FILE.test(file)) continue;
    found.push(
      `IP ${ip} (예시는 192.0.2.x·198.51.100.x·203.0.113.x, 실제 값은 .env)`,
    );
  }
  for (const m of line.matchAll(/\b([0-9a-f]{2}(?::[0-9a-f]{2}){5})\b/gi)) {
    if (/^00:00:5e:00:53:/i.test(m[1])) continue;
    found.push(`MAC ${m[1]} (예시는 00:00:5E:00:53:xx, 실제 값은 .env)`);
  }
  return found;
}

const denylist = loadDenylist();
if (process.argv.includes('--staged')) {
  const diff = execFileSync(
    'git',
    ['diff', '--cached', '--unified=0', '--no-color', '--diff-filter=AM'],
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  let file = '';
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('+++ ')) {
      file = raw.replace(/^\+\+\+ (?:b\/)?/, '');
      continue;
    }
    if (!raw.startsWith('+') || raw.startsWith('+++')) continue;
    for (const why of findSensitive(file, raw.slice(1), denylist)) {
      violations.push(`${file}: ${why}`);
    }
  }
}

if (violations.length) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `공개 소스 경계 검사 통과 (${files.length}개 파일${
      process.argv.includes('--staged')
        ? `, 커밋 변경 검사 · 로컬 금지어 ${denylist.length}개`
        : ''
    }). 자격증명 검사는 별도 secret scanning으로 수행합니다.`,
  );
}
