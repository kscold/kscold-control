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
    name: 'sampleproject',
    fileCount: 2,
    totalSize: '40',
  };
  const sessionDir = path.join(root, '.upload-sessions');
  const session = path.join(sessionDir, project.id, 'session.json');
  const receipt = path.join(root, '.upload-receipts/sampleproject/receipt.json');
  for (const directory of [
    'sampleproject',
    '.repository-versions/sampleproject',
    '.upload-staging/sampleproject',
    '.upload-backups/sampleproject',
    '.upload-receipts/sampleproject',
    '.upload-sessions/project-id',
  ]) {
    await fs.mkdir(path.join(root, directory), { recursive: true });
  }
  await fs.writeFile(
    path.join(root, 'sampleproject/.env'),
    'TEST_SECRET=fixture-only',
  );
  await fs.writeFile(
    path.join(root, '.repository-versions/sampleproject/old.tar.gz'),
    'unchanged-version-bytes',
  );
  await fs.writeFile(
    session,
    JSON.stringify({
      projectName: 'sampleproject',
      projectId: project.id,
      status: 'partial_failed',
    }),
  );
  await fs.writeFile(
    receipt,
    JSON.stringify({ projectName: 'sampleproject', state: 'published' }),
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
        assert.deepEqual(params, ['renamed-project', project.id, 'sampleproject']);
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
      from: 'sampleproject',
      to: 'renamed-project',
    },
  };
}

test('preview does not rename files or update project metadata', async (t) => {
  const f = await fixture(t);
  const result = await renameRepositoryProject(f.options);
  assert.equal(result.applied, false);
  assert.equal(result.metadataFiles, 2);
  assert.equal(
    (await fs.stat(path.join(f.root, 'sampleproject'))).isDirectory(),
    true,
  );
  assert.equal(
    JSON.parse(await fs.readFile(f.session, 'utf8')).projectName,
    'sampleproject',
  );
  assert(!f.queries.some((query) => query.startsWith('UPDATE')));
});

test('rename preserves bytes, versions, sessions, receipts and a private recovery journal', async (t) => {
  const f = await fixture(t);
  const result = await renameRepositoryProject({ ...f.options, apply: true });
  assert.equal(result.applied, true);
  assert.equal(
    await fs.readFile(path.join(f.root, 'renamed-project/.env'), 'utf8'),
    'TEST_SECRET=fixture-only',
  );
  assert.equal(
    await fs.readFile(
      path.join(f.root, '.repository-versions/renamed-project/old.tar.gz'),
      'utf8',
    ),
    'unchanged-version-bytes',
  );
  assert.equal(
    JSON.parse(await fs.readFile(f.session, 'utf8')).projectName,
    'renamed-project',
  );
  assert.equal(
    JSON.parse(
      await fs.readFile(
        path.join(f.root, '.upload-receipts/renamed-project/receipt.json'),
        'utf8',
      ),
    ).projectName,
    'renamed-project',
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
    await fs.readFile(path.join(f.root, 'sampleproject/.env'), 'utf8'),
    'TEST_SECRET=fixture-only',
  );
  assert.equal(
    JSON.parse(await fs.readFile(f.session, 'utf8')).projectName,
    'sampleproject',
  );
  await assert.rejects(fs.stat(path.join(f.root, 'renamed-project')), {
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
    'sampleproject',
  );
});
