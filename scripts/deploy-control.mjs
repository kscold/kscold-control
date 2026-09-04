import { execFileSync, spawnSync } from 'node:child_process';
import {
  closeSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lockPath = path.join(root, '.git', 'kscold-control-deploy.lock');

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} 실패`);
  }
}

async function waitForRelease(url, version, revision) {
  let lastError;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(3_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (
        payload.status === 'ok' &&
        payload.release?.version === version &&
        payload.release?.revision === revision &&
        payload.release?.integrity === 'verified'
      ) {
        return;
      }
      lastError = new Error('실행 중인 릴리스 정보가 빌드와 다릅니다.');
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw lastError ?? new Error(`릴리스 확인 실패: ${url}`);
}

function acquireDeploymentLock() {
  try {
    const descriptor = openSync(lockPath, 'wx', 0o600);
    writeFileSync(descriptor, `${process.pid}\n`, 'utf8');
    return descriptor;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let owner;
    try {
      owner = readFileSync(lockPath, 'utf8').trim();
    } catch (readError) {
      if (readError.code === 'ENOENT') return acquireDeploymentLock();
      throw readError;
    }
    const ownerPid = Number(owner);
    if (Number.isInteger(ownerPid) && ownerPid > 0) {
      try {
        process.kill(ownerPid, 0);
      } catch (processError) {
        if (processError.code === 'ESRCH') {
          unlinkSync(lockPath);
          return acquireDeploymentLock();
        }
      }
    }
    throw new Error(
      `다른 운영 배포가 진행 중입니다 (pid ${owner || 'unknown'}).`,
    );
  }
}

function releaseDeploymentLock(descriptor) {
  closeSync(descriptor);
  try {
    unlinkSync(lockPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

const lockDescriptor = acquireDeploymentLock();
try {
  if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') {
    throw new Error('운영 배포는 main 브랜치에서만 실행할 수 있습니다.');
  }
  if (git('status', '--porcelain')) {
    throw new Error('커밋되지 않은 변경이 있어 운영 배포를 중단했습니다.');
  }

  run('git', ['fetch', 'origin', 'main']);
  const revision = git('rev-parse', 'HEAD');
  const { version } = JSON.parse(
    readFileSync(path.join(root, 'package.json'), 'utf8'),
  );
  if (revision !== git('rev-parse', 'origin/main')) {
    throw new Error('로컬 main과 origin/main이 일치하지 않습니다.');
  }
  if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
    throw new Error('.env의 DATABASE_URL과 JWT_SECRET이 필요합니다.');
  }

  run('pnpm', ['check:architecture']);
  run('pnpm', ['check:runtime-contracts']);
  run('pnpm', ['lint']);
  run('pnpm', ['test:backend']);
  run('pnpm', ['test:frontend']);
  run('pnpm', ['build']);
  run('pnpm', ['verify:release']);
  run('pnpm', ['preflight:production']);
  run('pm2', ['startOrReload', 'ecosystem.config.js', '--update-env']);

  await waitForRelease('http://127.0.0.1:4000/api/health', version, revision);
  await waitForRelease(
    'https://control.kscold.com/api/health',
    version,
    revision,
  );
  run('pm2', ['save']);
  console.log(
    `Production release is healthy: v${version} ${revision.slice(0, 12)}`,
  );
} finally {
  releaseDeploymentLock(lockDescriptor);
}
