// 설치 프로그램에 넣을 Control 실행본을 bundle/control 에 만든다.
// 미리 저장소 루트에서 `pnpm build` 로 백엔드·프론트를 빌드해 둔다.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const repoRoot = path.resolve(desktopRoot, '..', '..');
const out = path.join(desktopRoot, 'bundle', 'control');
const backendOut = path.join(out, 'apps', 'backend');
const electronVersion = JSON.parse(
  readFileSync(path.join(desktopRoot, 'package.json'), 'utf8'),
).devDependencies.electron;

function need(relative) {
  const target = path.join(repoRoot, relative);
  if (!existsSync(target)) {
    throw new Error(
      `${relative} 가 없습니다. 저장소 루트에서 pnpm build 를 먼저 실행해 주세요.`,
    );
  }
  return target;
}

function run(command, args, cwd = repoRoot) {
  console.log(`$ ${command} ${args.join(' ')}`);
  execFileSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// 1) 백엔드: 운영 의존성만 담은 폴더를 만들고 빌드 결과·마이그레이션을 넣는다.
run('pnpm', [
  '--filter',
  '@kscold-control/backend',
  'deploy',
  '--prod',
  '--legacy',
  backendOut,
]);
rmSync(path.join(backendOut, 'src'), { recursive: true, force: true });
rmSync(path.join(backendOut, 'test'), { recursive: true, force: true });
cpSync(need('apps/backend/dist'), path.join(backendOut, 'dist'), {
  recursive: true,
});
cpSync(need('apps/backend/migrations'), path.join(backendOut, 'migrations'), {
  recursive: true,
});

// 2) 마이그레이션 스크립트: pg 를 백엔드 node_modules 에서 찾도록 백엔드 폴더 안에 둔다.
mkdirSync(path.join(backendOut, 'scripts', 'lib'), { recursive: true });
cpSync(
  need('scripts/migrate-control-db.mjs'),
  path.join(backendOut, 'scripts', 'migrate-control-db.mjs'),
);
cpSync(
  need('scripts/lib/migration-compatibility.mjs'),
  path.join(backendOut, 'scripts', 'lib', 'migration-compatibility.mjs'),
);

// 3) 프론트: 백엔드가 그대로 내보내는 정적 파일 위치.
cpSync(
  need('apps/frontend/dist'),
  path.join(out, 'runtime', 'frontend-current'),
  { recursive: true },
);

// 4) 네이티브 모듈(node-pty·bcrypt)을 Electron 의 Node 에 맞게 다시 빌드한다.
run(
  'npx',
  [
    '@electron/rebuild',
    '--version',
    electronVersion.replace(/^[^\d]*/, ''),
    '--module-dir',
    backendOut,
    '--only',
    'node-pty,bcrypt',
  ],
  desktopRoot,
);

console.log(`Control 실행본을 만들었습니다: ${out}`);
