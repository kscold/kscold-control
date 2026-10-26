import { readFileSync } from 'node:fs';
import path from 'node:path';

export function checkReleaseVersion(root) {
  const files = [
    'package.json',
    'apps/backend/package.json',
    'apps/frontend/package.json',
  ];
  const versions = files.map(
    (file) => JSON.parse(readFileSync(path.join(root, file), 'utf8')).version,
  );
  if (
    !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(versions[0]) ||
    versions.some((version) => version !== versions[0])
  ) {
    throw new Error('루트·백엔드·프론트엔드의 릴리스 버전이 일치해야 합니다.');
  }
  const changelog = readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
  const latest = changelog.match(/^## ([\w.-]+) - \d{4}-\d{2}-\d{2}$/m)?.[1];
  if (latest !== versions[0])
    throw new Error('CHANGELOG의 최신 항목과 패키지 버전이 다릅니다.');
  return versions[0];
}
