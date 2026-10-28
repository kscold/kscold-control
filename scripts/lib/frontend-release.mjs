import {
  cpSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

const REVISION_PATTERN = /^[a-f0-9]{40}$/;
const ASSET_MANIFEST = '.control-frontend-assets.json';
const HASHED_ASSET =
  /^[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|ttf|otf|wasm|svg|png|jpe?g|webp|gif|ico)$/;

function originalAssets(directory) {
  const assets = path.join(directory, 'assets');
  const manifest = path.join(directory, ASSET_MANIFEST);
  const names = existsSync(manifest)
    ? JSON.parse(readFileSync(manifest, 'utf8'))
    : existsSync(assets)
      ? readdirSync(assets).filter((name) => HASHED_ASSET.test(name))
      : [];
  if (
    !Array.isArray(names) ||
    names.length > 10_000 ||
    names.some((name) => typeof name !== 'string' || !HASHED_ASSET.test(name))
  )
    throw new Error('프론트엔드 원본 자산 목록이 올바르지 않습니다.');
  for (const name of names) {
    if (!lstatSync(path.join(assets, name)).isFile())
      throw new Error('프론트엔드 자산은 일반 파일이어야 합니다.');
  }
  return names;
}

export function publishFrontendRelease({
  root,
  revision,
  now = Date.now(),
  retainedReleases = 5,
}) {
  if (!REVISION_PATTERN.test(revision)) {
    throw new Error('프론트엔드 릴리스 리비전 형식이 올바르지 않습니다.');
  }
  if (
    !Number.isInteger(retainedReleases) ||
    retainedReleases < 1 ||
    retainedReleases > 20
  )
    throw new Error('프론트엔드 릴리스 보관 수는 1~20이어야 합니다.');

  // Express sendFile ignores paths containing hidden segments by default.
  const runtimeRoot = path.join(root, 'runtime');
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
  const staleReleases = readdirSync(releaseRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name !== releaseName &&
        /^[a-f0-9]{40}-\d+$/.test(entry.name),
    )
    .map((entry) => ({
      name: entry.name,
      modifiedAt: statSync(path.join(releaseRoot, entry.name)).mtimeMs,
    }))
    .sort(
      (left, right) =>
        right.modifiedAt - left.modifiedAt ||
        Number(right.name.slice(41)) - Number(left.name.slice(41)),
    );
  try {
    rmSync(staging, { recursive: true, force: true });
    rmSync(nextLink, { force: true });
    cpSync(source, staging, { recursive: true, errorOnExist: true });
    // 이전 자산을 합치기 전에 이번 빌드의 원본만 기록해 누적 보관을 막는다.
    writeFileSync(
      path.join(staging, ASSET_MANIFEST),
      JSON.stringify(originalAssets(staging)),
      { mode: 0o600 },
    );
    for (const previous of staleReleases.slice(0, retainedReleases - 1)) {
      const directory = path.join(releaseRoot, previous.name);
      for (const name of originalAssets(directory)) {
        const target = path.join(staging, 'assets', name);
        if (existsSync(target)) continue;
        mkdirSync(path.dirname(target), { recursive: true });
        copyFileSync(path.join(directory, 'assets', name), target);
      }
    }
    renameSync(staging, destination);
    symlinkSync(path.relative(runtimeRoot, destination), nextLink, 'dir');
    renameSync(nextLink, currentPath);
  } finally {
    rmSync(staging, { recursive: true, force: true });
    rmSync(nextLink, { force: true });
  }

  for (const stale of staleReleases.slice(Math.max(0, retainedReleases - 1))) {
    rmSync(path.join(releaseRoot, stale.name), {
      recursive: true,
      force: true,
    });
  }

  return { currentPath, destination };
}
