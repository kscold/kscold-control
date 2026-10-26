import assert from 'node:assert/strict';
import { test } from 'node:test';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renameRepositoryProject } from '../rename-repository-project.mjs';

async function fixture(
  t,
  { failUpdate = false, destinationExists = false } = {},
) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'control-rename-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const project = {
    id: 'project-id',
    name: 'bigzmai',
    fileCount: 2,
    totalSize: '40',
  };
  const sessionDir = path.join(root, '.upload-sessions');
  const session = path.join(sessionDir, project.id, 'session.json');
  const receipt = path.join(root, '.upload-receipts/bigzmai/receipt.json');
  for (const directory of [
    'bigzmai',
    '.repository-versions/bigzmai',
    '.upload-staging/bigzmai',
    '.upload-backups/bigzmai',
    '.upload-receipts/bigzmai',
    '.upload-sessions/project-id',
  ]) {
    await fs.mkdir(path.join(root, directory), { recursive: true });
  }
  await fs.writeFile(
    path.join(root, 'bigzmai/.env'),
    'TEST_SECRET=fixture-only',
  );
  await fs.writeFile(
    path.join(root, '.repository-versions/bigzmai/old.tar.gz'),
    'unchanged-version-bytes',
  );
  await fs.writeFile(
    session,
    JSON.stringify({
      projectName: 'bigzmai',
      projectId: project.id,
      status: 'partial_failed',
    }),
  );
  await fs.writeFile(
    receipt,
    JSON.stringify({ projectName: 'bigzmai', state: 'published' }),
  );
  const queries = [];
  const client = {
    async query(sql, params) {
      queries.push(sql);
      if (sql.startsWith('SELECT *')) return { rows: [{ ...project }] };
      if (sql.startsWith('SELECT id'))
        return { rows: destinationExists ? [{ id: 'other-project' }] : [] };
      if (sql.startsWith('UPDATE')) {
        if (failUpdate) throw new Error('simulated database failure');
        assert.deepEqual(params, ['bigzami', project.id, 'bigzmai']);
        return { rowCount: 1 };
      }
      return { rows: [] };
    },
  };
  return {
    root,
    session,
    queries,
    options: {
      client,
      storageDir: root,
      sessionDir,
      backupDir: path.join(root, 'private-journal'),
      from: 'bigzmai',
      to: 'bigzami',
    },
  };
}

test('preview does not rename files or update project metadata', async (t) => {
  const f = await fixture(t);
  const result = await renameRepositoryProject(f.options);
  assert.equal(result.applied, false);
  assert.equal(result.metadataFiles, 2);
  assert.equal(
    (await fs.stat(path.join(f.root, 'bigzmai'))).isDirectory(),
    true,
  );
  assert.equal(
    JSON.parse(await fs.readFile(f.session, 'utf8')).projectName,
    'bigzmai',
  );
  assert(!f.queries.some((query) => query.startsWith('UPDATE')));
});

test('rename preserves bytes, versions, sessions, receipts and a private recovery journal', async (t) => {
  const f = await fixture(t);
  const result = await renameRepositoryProject({ ...f.options, apply: true });
  assert.equal(result.applied, true);
  assert.equal(
    await fs.readFile(path.join(f.root, 'bigzami/.env'), 'utf8'),
    'TEST_SECRET=fixture-only',
  );
  assert.equal(
    await fs.readFile(
      path.join(f.root, '.repository-versions/bigzami/old.tar.gz'),
      'utf8',
    ),
    'unchanged-version-bytes',
  );
  assert.equal(
    JSON.parse(await fs.readFile(f.session, 'utf8')).projectName,
    'bigzami',
  );
  assert.equal(
    JSON.parse(
      await fs.readFile(
        path.join(f.root, '.upload-receipts/bigzami/receipt.json'),
        'utf8',
      ),
    ).projectName,
    'bigzami',
  );
  assert.equal(
    JSON.parse(await fs.readFile(result.journal, 'utf8')).state,
    'completed',
  );
  assert.equal((await fs.stat(result.journal)).mode & 0o777, 0o600);
  assert(f.queries.includes('COMMIT'));
});

test('database failure restores original directories and session metadata', async (t) => {
  const f = await fixture(t, { failUpdate: true });
  await assert.rejects(
    renameRepositoryProject({ ...f.options, apply: true }),
    /simulated database failure/,
  );
  assert.equal(
    await fs.readFile(path.join(f.root, 'bigzmai/.env'), 'utf8'),
    'TEST_SECRET=fixture-only',
  );
  assert.equal(
    JSON.parse(await fs.readFile(f.session, 'utf8')).projectName,
    'bigzmai',
  );
  await assert.rejects(fs.stat(path.join(f.root, 'bigzami')), {
    code: 'ENOENT',
  });
  assert(f.queries.includes('ROLLBACK'));
});

test('an existing destination never gets overwritten', async (t) => {
  const f = await fixture(t, { destinationExists: true });
  await assert.rejects(
    renameRepositoryProject({ ...f.options, apply: true }),
    /already exists/,
  );
  assert.equal(
    JSON.parse(await fs.readFile(f.session, 'utf8')).projectName,
    'bigzmai',
  );
});
