import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const entrypoint = fs.readFileSync(
  new URL('../../docker/gadoc/entrypoint.sh', import.meta.url),
  'utf8',
);
const guard = entrypoint.match(
  /<<'ENV_APPLY_GUARD'\n([\s\S]*?)\nENV_APPLY_GUARD/,
)[1];
const services = entrypoint.match(
  /gosu mongodb mongod[\s\S]*?wait "\$!"\s*$/,
)[0];
const keyGuard = entrypoint.match(
  /if grep -Ev[^\n]*"\$root_keys"[^\n]*\n[\s\S]*?\nfi/,
)[0];
const quote = (value) => `'${value.replace(/'/g, `'"'"'`)}'`;

function fixture(t) {
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'gadoc-boot-'));
  t.after(() => fs.rmSync(state, { force: true, recursive: true }));
  fs.mkdirSync(path.join(state, 'current'));
  fs.writeFileSync(
    path.join(state, 'current/ecosystem.config.json'),
    '{"apps":[]}',
  );
  return state;
}

function runGuard(state, prefix = '') {
  // Execute the actual Node preflight embedded in the production entrypoint.
  return spawnSync(process.execPath, ['-', state], {
    input: prefix + guard,
    encoding: 'utf8',
  });
}

function startServices(state, allowed) {
  const bin = path.join(state, 'bin');
  const log = path.join(state, 'services');
  fs.mkdirSync(bin);
  for (const [command, name] of [
    ['gosu', 'mongo'],
    ['pm2', 'pm2'],
    ['sshd', 'ssh'],
  ]) {
    fs.writeFileSync(
      path.join(bin, command),
      `#!/bin/sh\nprintf '%s\\n' '${name}' >> ${quote(log)}\n`,
      { mode: 0o755 },
    );
  }
  // Run the production service-start tail with only executables replaced by
  // harmless stubs. No container, DB, SSH daemon, or real PM2 is started.
  const source = `set -euo pipefail\nstate=${quote(state)}\nruntime_allowed=${allowed ? 1 : 0}\nPATH=${quote(`${bin}:${process.env.PATH}`)}\n${services.replace('/usr/sbin/sshd', quote(path.join(bin, 'sshd')))}`;
  const result = spawnSync('bash', ['-c', source], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return fs.readFileSync(log, 'utf8').trim().split('\n');
}

test('clean runtime preflight allows the normal Mongo/PM2/SSH startup sequence', (t) => {
  const state = fixture(t);
  const result = runGuard(state);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(startServices(state, result.status === 0), [
    'mongo',
    'pm2',
    'ssh',
  ]);
});

for (const kind of [
  'journal',
  'broken-symlink',
  'directory',
  'unreadable',
  'io-error',
]) {
  test(`pending ${kind} defers only PM2 and keeps Mongo/SSH available for recovery`, (t) => {
    const state = fixture(t);
    const journal = path.join(state, 'env-apply-pending.json');
    let prefix = '';
    if (kind === 'broken-symlink')
      fs.symlinkSync(path.join(state, 'missing'), journal);
    else if (kind === 'directory') fs.mkdirSync(journal);
    else if (kind === 'io-error')
      prefix = `{
      const module = require('node:fs'); const original = module.lstatSync;
      module.lstatSync = file => { if (file.endsWith('/env-apply-pending.json')) throw Object.assign(new Error(), {code:'EACCES'}); return original(file); };
    }\n`;
    else
      fs.writeFileSync(
        journal,
        'malformed journal is still a recovery barrier',
        { mode: kind === 'unreadable' ? 0 : 0o600 },
      );
    const result = runGuard(state, prefix);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(startServices(state, result.status === 0), [
      'mongo',
      'ssh',
    ]);
    assert.match(
      entrypoint,
      /Application startup deferred: environment apply recovery is required\./,
    );
    assert.match(
      entrypoint,
      /then\s+runtime_allowed=1[\s\S]*?: > \/run\/gadoc-env-apply-blocked/,
    );
  });
}

test('the runtime blocked signal marks health unhealthy before probing services', (t) => {
  const state = fixture(t);
  const flag = path.join(state, 'blocked');
  fs.writeFileSync(flag, '');
  const health = fs.readFileSync(
    new URL('../../docker/gadoc/healthcheck.sh', import.meta.url),
    'utf8',
  );
  const line = health
    .split('\n')
    .find((value) => value.includes('/run/gadoc-env-apply-blocked'));
  const result = spawnSync(
    'bash',
    [
      '-c',
      line.replaceAll('/run/gadoc-env-apply-blocked', flag) +
        '\nprintf unsafe\\n',
    ],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
});

const oldKey =
  'restrict,command="/app/slacord-deploy/tools/ssh-entrypoint.sh" ssh-ed25519 QUJD old';
const kmsKey =
  'restrict,command="/usr/local/sbin/gadoc-kms-env" ssh-ed25519 REVG kms';
for (const [name, keys, code] of [
  ['existing deploy key', oldKey, 0],
  ['dedicated KMS key', kmsKey, 0],
  ['both keys', `${oldKey}\n${kmsKey}`, 0],
  ['unrestricted key', 'ssh-ed25519 QUJD plain', 1],
  [
    'arbitrary forced command',
    'restrict,command="/bin/bash" ssh-ed25519 QUJD arbitrary',
    1,
  ],
  [
    'extra SSH options',
    'restrict,command="/usr/local/sbin/gadoc-kms-env",environment="PATH=/tmp" ssh-ed25519 QUJD bad',
    1,
  ],
  [
    'path prefix bypass',
    'restrict,command="/usr/local/sbin/gadoc-kms-env-extra" ssh-ed25519 QUJD bad',
    1,
  ],
  [
    'dot wildcard bypass',
    'restrict,command="/app/slacord-deploy/tools/ssh-entrypointXsh" ssh-ed25519 QUJD bad',
    1,
  ],
]) {
  test(`root key validation: ${name}`, (t) => {
    const state = fixture(t);
    const file = path.join(state, 'root-keys');
    fs.writeFileSync(file, keys + '\n');
    const result = spawnSync(
      'bash',
      ['-c', `root_keys=${quote(file)}\n${keyGuard}`],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, code, result.stderr);
  });
}
