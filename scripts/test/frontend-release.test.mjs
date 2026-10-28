import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
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

test('이전 화면의 지연 번들을 유지하되 릴리스 보관 수를 넘어 누적하지 않는다', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'control-assets-'));
  const source = path.join(root, 'apps/frontend/dist');
  const assets = path.join(source, 'assets');
  mkdirSync(assets, { recursive: true });
  const publish = (letter, now) =>
    publishFrontendRelease({
      root,
      revision: letter.repeat(40),
      now,
      retainedReleases: 2,
    });
  const prepare = (letter) => {
    for (const file of readdirSync(assets)) rmSync(path.join(assets, file));
    writeFileSync(path.join(source, 'index.html'), `index-${letter}`);
    writeFileSync(
      path.join(assets, `workspace-${letter.repeat(8)}.js`),
      letter,
    );
    writeFileSync(
      path.join(assets, `workspace-${letter.repeat(8)}.css`),
      letter,
    );
  };
  try {
    prepare('a');
    publish('a', 1);
    prepare('b');
    const second = publish('b', 2);
    assert.equal(
      readFileSync(
        path.join(second.currentPath, 'assets/workspace-aaaaaaaa.js'),
        'utf8',
      ),
      'a',
    );
    assert.equal(
      readFileSync(
        path.join(second.currentPath, 'assets/workspace-aaaaaaaa.css'),
        'utf8',
      ),
      'a',
    );
    assert.deepEqual(
      JSON.parse(
        readFileSync(
          path.join(second.currentPath, '.control-frontend-assets.json'),
          'utf8',
        ),
      ).sort(),
      ['workspace-bbbbbbbb.css', 'workspace-bbbbbbbb.js'],
    );
    prepare('c');
    const third = publish('c', 3);
    assert.deepEqual(
      readdirSync(path.join(third.currentPath, 'assets')).sort(),
      [
        'workspace-bbbbbbbb.css',
        'workspace-bbbbbbbb.js',
        'workspace-cccccccc.css',
        'workspace-cccccccc.js',
      ],
    );
    assert.equal(
      readdirSync(path.join(root, 'runtime/frontend-releases')).length,
      2,
    );
    assert.equal(
      readFileSync(path.join(third.currentPath, 'index.html'), 'utf8'),
      'index-c',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('기존 릴리스 자산의 symlink는 따르지 않고 현재 링크를 보존한다', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'control-assets-symlink-'));
  const source = path.join(root, 'apps/frontend/dist');
  mkdirSync(path.join(source, 'assets'), { recursive: true });
  try {
    writeFileSync(path.join(source, 'index.html'), 'first');
    writeFileSync(path.join(source, 'assets/workspace-aaaaaaaa.js'), 'safe');
    const first = publishFrontendRelease({
      root,
      revision: 'a'.repeat(40),
      now: 1,
    });
    const old = path.join(first.destination, 'assets/workspace-aaaaaaaa.js');
    rmSync(old);
    symlinkSync(path.join(source, 'index.html'), old);
    writeFileSync(path.join(source, 'index.html'), 'second');
    assert.throws(
      () => publishFrontendRelease({ root, revision: 'b'.repeat(40), now: 2 }),
      /일반 파일/,
    );
    assert.equal(
      readFileSync(path.join(first.currentPath, 'index.html'), 'utf8'),
      'first',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
