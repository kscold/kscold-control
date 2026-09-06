import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { publishFrontendRelease } from '../lib/frontend-release.mjs';

test('프론트엔드 릴리스를 원자 링크로 발행하고 교체한다', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'control-frontend-release-'));
  const source = path.join(root, 'apps', 'frontend', 'dist');
  mkdirSync(path.join(source, 'assets'), { recursive: true });

  try {
    writeFileSync(path.join(source, 'index.html'), 'release-a');
    writeFileSync(path.join(source, 'assets', 'app.js'), 'asset-a');
    const first = publishFrontendRelease({
      root,
      revision: 'a'.repeat(40),
      now: 1,
    });
    assert.equal(
      first.currentPath,
      path.join(root, 'runtime', 'frontend-current'),
    );
    assert.equal(
      readFileSync(path.join(first.currentPath, 'index.html'), 'utf8'),
      'release-a',
    );

    writeFileSync(path.join(source, 'index.html'), 'release-b');
    const second = publishFrontendRelease({
      root,
      revision: 'b'.repeat(40),
      now: 2,
    });
    assert.equal(first.currentPath, second.currentPath);
    assert.equal(
      readFileSync(path.join(second.currentPath, 'index.html'), 'utf8'),
      'release-b',
    );
    assert.equal(
      readFileSync(path.join(first.destination, 'index.html'), 'utf8'),
      'release-a',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('경로로 사용할 수 없는 리비전을 거절한다', () => {
  assert.throws(
    () =>
      publishFrontendRelease({
        root: '/tmp/control-release-invalid',
        revision: '../invalid',
      }),
    /리비전 형식/,
  );
});
