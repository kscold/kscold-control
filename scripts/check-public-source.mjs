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
if (violations.length) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `공개 소스 경계 검사 통과 (${files.length}개 파일). 자격증명 검사는 별도 secret scanning으로 수행합니다.`,
  );
}
