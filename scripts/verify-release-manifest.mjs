import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(
  root,
  'apps',
  'backend',
  'dist',
  'release-manifest.json',
);
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const packageMetadata = JSON.parse(
  await fs.readFile(path.join(root, 'package.json'), 'utf8'),
);
const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).trim();
const workingTree = execFileSync('git', ['status', '--porcelain'], {
  cwd: root,
  encoding: 'utf8',
}).trim();
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

async function listFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(target) : [target];
    }),
  );
  return files.flat();
}

if (
  manifest.schemaVersion !== 2 ||
  manifest.version !== packageMetadata.version ||
  manifest.revision !== revision
) {
  throw new Error('빌드 산출물과 현재 Git 리비전이 일치하지 않습니다.');
}
if (manifest.dirty || workingTree) {
  throw new Error('변경 중인 작업 트리에서 만든 빌드는 배포할 수 없습니다.');
}

const actualPaths = (
  await Promise.all(
    ['apps/backend/dist', 'apps/frontend/dist'].map((directory) =>
      listFiles(path.join(root, directory)),
    ),
  )
)
  .flat()
  .map((filePath) => path.relative(root, filePath).replaceAll(path.sep, '/'))
  .filter(
    (relativePath) =>
      relativePath !== 'apps/backend/dist/release-manifest.json',
  )
  .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
const manifestPaths = Object.keys(manifest.artifacts ?? {}).sort(
  (left, right) => (left < right ? -1 : left > right ? 1 : 0),
);
if (
  actualPaths.length === 0 ||
  actualPaths.length !== manifestPaths.length ||
  actualPaths.some(
    (relativePath, index) => relativePath !== manifestPaths[index],
  )
) {
  throw new Error(
    '릴리스 매니페스트와 배포 산출물 파일 목록이 일치하지 않습니다.',
  );
}

for (const [relativePath, expectedHash] of Object.entries(
  manifest.artifacts ?? {},
)) {
  if (!SHA256_PATTERN.test(expectedHash)) {
    throw new Error(`산출물 해시 형식이 올바르지 않습니다: ${relativePath}`);
  }
  const content = await fs.readFile(path.join(root, relativePath));
  const actualHash = createHash('sha256').update(content).digest('hex');
  if (actualHash !== expectedHash) {
    throw new Error(`빌드 산출물 해시가 일치하지 않습니다: ${relativePath}`);
  }
}

console.log(
  `Release verified: v${manifest.version} ${revision.slice(0, 12)} (${actualPaths.length} files)`,
);
