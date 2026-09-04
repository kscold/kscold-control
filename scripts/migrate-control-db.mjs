import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDirectory = path.join(root, 'apps/backend/migrations');
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL이 없어 DB 마이그레이션을 실행할 수 없습니다.');
}

const databaseUrl = new URL(connectionString);
const target = `${databaseUrl.hostname}/${decodeURIComponent(databaseUrl.pathname.slice(1))}`;
const client = new Client({ connectionString });

await client.connect();
try {
  await client.query('BEGIN');
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtext('kscold-control-schema-migrations'))",
  );
  await client.query(`
    CREATE TABLE IF NOT EXISTS control_schema_migrations (
      id varchar(160) PRIMARY KEY,
      checksum varchar(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const entries = (
    await fs.readdir(migrationsDirectory, { withFileTypes: true })
  )
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort();
  let applied = 0;
  let skipped = 0;

  for (const id of entries) {
    const sql = await fs.readFile(path.join(migrationsDirectory, id), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const existing = await client.query(
      'SELECT checksum FROM control_schema_migrations WHERE id = $1',
      [id],
    );

    if (existing.rowCount) {
      if (existing.rows[0].checksum !== checksum) {
        throw new Error(`이미 적용된 마이그레이션 체크섬이 다릅니다: ${id}`);
      }
      skipped += 1;
      continue;
    }

    await client.query(sql);
    await client.query(
      'INSERT INTO control_schema_migrations (id, checksum) VALUES ($1, $2)',
      [id, checksum],
    );
    applied += 1;
  }

  await client.query('COMMIT');
  console.log(
    `Database migrations complete: ${target} (${applied} applied, ${skipped} unchanged)`,
  );
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
