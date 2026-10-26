import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkReleaseVersion } from '../lib/release-version.mjs';

test('릴리스 버전과 변경 이력의 불일치를 배포 전에 막음', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'control-version-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const folder of ['', 'apps/backend', 'apps/frontend']) {
    mkdirSync(path.join(root, folder), { recursive: true });
    writeFileSync(
      path.join(root, folder, 'package.json'),
      JSON.stringify({ version: '1.2.3' }),
    );
  }
  writeFileSync(
    path.join(root, 'CHANGELOG.md'),
    '# Changelog\n\n## 1.2.3 - 2026-01-01\n',
  );
  assert.equal(checkReleaseVersion(root), '1.2.3');
  writeFileSync(
    path.join(root, 'apps/frontend/package.json'),
    JSON.stringify({ version: '1.2.4' }),
  );
  assert.throws(() => checkReleaseVersion(root), /버전이 일치/);
  writeFileSync(
    path.join(root, 'apps/frontend/package.json'),
    JSON.stringify({ version: '1.2.3' }),
  );
  writeFileSync(
    path.join(root, 'CHANGELOG.md'),
    '# Changelog\n\n## 1.2.2 - 2026-01-01\n',
  );
  assert.throws(() => checkReleaseVersion(root), /최신 항목/);
});
