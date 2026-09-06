import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
} from 'node:fs';
import path from 'node:path';

const REVISION_PATTERN = /^[a-f0-9]{40}$/;

export function publishFrontendRelease({
  root,
  revision,
  now = Date.now(),
  retainedReleases = 5,
}) {
  if (!REVISION_PATTERN.test(revision)) {
    throw new Error('프론트엔드 릴리스 리비전 형식이 올바르지 않습니다.');
  }

  const runtimeRoot = path.join(root, '.runtime');
  const releaseRoot = path.join(runtimeRoot, 'frontend-releases');
  const currentPath = path.join(runtimeRoot, 'frontend-current');
  const source = path.join(root, 'apps', 'frontend', 'dist');
  const releaseName = `${revision}-${now}`;
  const destination = path.join(releaseRoot, releaseName);
  const staging = `${destination}.staging-${process.pid}`;
  const nextLink = `${currentPath}.next-${process.pid}`;

  if (!existsSync(path.join(source, 'index.html'))) {
    throw new Error('발행할 프론트엔드 index.html이 없습니다.');
  }

  mkdirSync(releaseRoot, { recursive: true, mode: 0o700 });
  try {
    rmSync(staging, { recursive: true, force: true });
    rmSync(nextLink, { force: true });
    cpSync(source, staging, { recursive: true, errorOnExist: true });
    renameSync(staging, destination);
    symlinkSync(path.relative(runtimeRoot, destination), nextLink, 'dir');
    renameSync(nextLink, currentPath);
  } finally {
    rmSync(staging, { recursive: true, force: true });
    rmSync(nextLink, { force: true });
  }

  const staleReleases = readdirSync(releaseRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== releaseName)
    .map((entry) => ({
      name: entry.name,
      modifiedAt: statSync(path.join(releaseRoot, entry.name)).mtimeMs,
    }))
    .sort((left, right) => right.modifiedAt - left.modifiedAt);
  for (const stale of staleReleases.slice(Math.max(0, retainedReleases - 1))) {
    rmSync(path.join(releaseRoot, stale.name), {
      recursive: true,
      force: true,
    });
  }

  return { currentPath, destination };
}
