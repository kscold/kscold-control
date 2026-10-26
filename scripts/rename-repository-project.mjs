import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const stores = [
  '',
  '.repository-versions',
  '.upload-staging',
  '.upload-receipts',
  '.upload-backups',
];

async function directoryExists(directory) {
  try {
    const stat = await fs.lstat(directory);
    assert(
      stat.isDirectory() && !stat.isSymbolicLink(),
      'Expected a real directory',
    );
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function jsonRecords(directory, from, to) {
  if (!(await directoryExists(directory))) return [];
  const records = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    assert(!entry.isSymbolicLink(), 'Symlink metadata is not supported');
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const target = path.join(directory, entry.name);
    const original = await fs.readFile(target, 'utf8');
    const record = JSON.parse(original);
    assert.equal(
      record.projectName,
      from,
      'Project metadata name does not match',
    );
    if (record.state)
      assert.equal(
        record.state,
        'published',
        'Recover interrupted publish before renaming',
      );
    records.push({
      target,
      original,
      updated: JSON.stringify({ ...record, projectName: to }, null, 2),
    });
  }
  return records;
}

async function writeAtomic(target, content) {
  const temporary = `${target}.rename-${process.pid}.tmp`;
  try {
    await fs.writeFile(temporary, content, { mode: 0o600, flag: 'wx' });
    await fs.rename(temporary, target);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

// Apply only while the HTTP/worker process is stopped; a DB lock alone cannot
// exclude uploads that are already writing to the filesystem.
export async function renameRepositoryProject({
  client,
  storageDir,
  sessionDir,
  backupDir,
  from,
  to,
  apply = false,
}) {
  assert(/^[a-z0-9][a-z0-9_-]{0,99}$/.test(from), 'Invalid source name');
  assert(
    /^[a-z0-9][a-z0-9_-]{0,99}$/.test(to) && from !== to,
    'Invalid destination name',
  );
  const moved = [];
  let records = [];
  let journal;
  let commitAttempted = false;
  await client.query('BEGIN');
  try {
    const result = await client.query(
      'SELECT * FROM repository_projects WHERE name = $1 FOR UPDATE',
      [from],
    );
    assert.equal(result.rows.length, 1, 'Source project not found');
    const project = result.rows[0];
    assert(/^[a-zA-Z0-9_-]+$/.test(project.id), 'Invalid project ID');
    const destination = await client.query(
      'SELECT id FROM repository_projects WHERE name = $1',
      [to],
    );
    assert.equal(
      destination.rows.length,
      0,
      'Destination project already exists',
    );
    assert(
      await directoryExists(path.join(storageDir, from)),
      'Source directory missing',
    );
    const moves = [];
    for (const store of stores) {
      const source = path.join(storageDir, store, from);
      const target = path.join(storageDir, store, to);
      assert(
        !(await directoryExists(target)),
        'Destination directory already exists',
      );
      if (await directoryExists(source)) moves.push({ source, target });
    }
    records = [
      ...(await jsonRecords(path.join(sessionDir, project.id), from, to)),
      ...(await jsonRecords(
        path.join(storageDir, '.upload-receipts', from),
        from,
        to,
      )),
    ];
    const summary = {
      projectId: project.id,
      from,
      to,
      fileCount: project.fileCount,
      totalSize: project.totalSize,
      directories: moves.length,
      metadataFiles: records.length,
    };
    if (!apply) {
      await client.query('ROLLBACK');
      return { ...summary, applied: false };
    }
    assert(backupDir, 'A private backup directory is required');
    await fs.mkdir(backupDir, { recursive: true, mode: 0o700 });
    await fs.chmod(backupDir, 0o700);
    journal = path.join(backupDir, `${from}-to-${to}-${Date.now()}.json`);
    await fs.writeFile(
      journal,
      JSON.stringify({ state: 'prepared', project, moves, records }, null, 2),
      { mode: 0o600, flag: 'wx' },
    );
    for (const record of records)
      await writeAtomic(record.target, record.updated);
    for (const move of moves) {
      await fs.rename(move.source, move.target);
      moved.push(move);
    }
    const updated = await client.query(
      'UPDATE repository_projects SET name = $1, "updatedAt" = NOW() WHERE id = $2 AND name = $3',
      [to, project.id, from],
    );
    assert.equal(updated.rowCount, 1, 'Project changed during rename');
    commitAttempted = true;
    await client.query('COMMIT');
    await writeAtomic(
      journal,
      JSON.stringify({ state: 'completed', project, moves, records }, null, 2),
    );
    return { ...summary, applied: true, journal };
  } catch (error) {
    if (commitAttempted) {
      // A disconnected COMMIT may have succeeded. Do not guess and move data back.
      throw new Error(
        `Verify database outcome before recovery; journal: ${journal}`,
        { cause: error },
      );
    }
    try {
      for (const move of [...moved].reverse())
        await fs.rename(move.target, move.source);
      if (journal)
        for (const record of records)
          await writeAtomic(record.target, record.original);
    } finally {
      await client.query('ROLLBACK');
    }
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const [from, to] = args.filter((arg) => arg !== '--apply');
  if (apply) {
    const processes = JSON.parse(
      execFileSync('pm2', ['jlist'], { encoding: 'utf8' }),
    );
    const control = processes.filter(
      (entry) => entry.name === 'kscold-control',
    );
    assert(
      control.length > 0 &&
        control.every((entry) => entry.pm2_env.status === 'stopped'),
      'Stop only kscold-control before applying a repository rename',
    );
  }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const require = createRequire(path.join(root, 'apps/backend/package.json'));
  const { Client } = require('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  const storageDir =
    process.env.REPOSITORY_STORAGE_DIR ??
    path.join(os.homedir(), 'repository-storage');
  await client.connect();
  try {
    console.log(
      JSON.stringify(
        await renameRepositoryProject({
          client,
          storageDir,
          from,
          to,
          apply,
          sessionDir:
            process.env.REPOSITORY_UPLOAD_SESSION_DIR ??
            path.join(storageDir, '.upload-sessions'),
          backupDir: path.join(
            os.homedir(),
            '.local/state/kscold-control/repository-renames',
          ),
        }),
      ),
    );
  } finally {
    await client.end();
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
