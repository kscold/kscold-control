#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  echo ".env 파일이 없습니다." >&2
  exit 1
fi

DB_CONNECTION="$(node --env-file=.env -e '
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL이 없습니다.");
  const url = new URL(value);
  const user = decodeURIComponent(url.username);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!/^[A-Za-z0-9_.-]+$/.test(user) || !/^[A-Za-z0-9_.-]+$/.test(database)) {
    throw new Error("DATABASE_URL의 사용자 또는 DB 이름이 올바르지 않습니다.");
  }
  process.stdout.write(`${user}\t${database}`);
')"
IFS=$'\t' read -r DB_USER DB_NAME <<< "$DB_CONNECTION"

docker exec -i kscold-infra-db \
  psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" \
  < apps/backend/migrations/20260904000000-create-secret-backups.sql

echo "key management migration complete"
