import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(
  root,
  'apps',
  'backend',
  'dist',
  'release-manifest.json',
);
const packageMetadata = JSON.parse(
  await fs.readFile(path.join(root, 'package.json'), 'utf8'),
);

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

async function sha256(relativePath) {
  const content = await fs.readFile(path.join(root, relativePath));
  return createHash('sha256').update(content).digest('hex');
}

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

const artifactFiles = (
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

const artifacts = Object.fromEntries(
  await Promise.all(
    artifactFiles.map(async (relativePath) => [
      relativePath,
      await sha256(relativePath),
    ]),
  ),
);
if (
  !artifacts['apps/backend/dist/main.js'] ||
  !artifacts['apps/frontend/dist/index.html']
) {
  throw new Error(
    '필수 배포 산출물이 없어 릴리스 매니페스트를 만들 수 없습니다.',
  );
}
const manifest = {
  schemaVersion: 2,
  version: packageMetadata.version,
  revision: git('rev-parse', 'HEAD'),
  branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
  builtAt: new Date().toISOString(),
  dirty: git('status', '--porcelain').length > 0,
  artifacts,
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `Release manifest written: v${manifest.version} ${manifest.revision.slice(0, 12)} (${artifactFiles.length} files)${manifest.dirty ? ' (dirty)' : ''}`,
);
