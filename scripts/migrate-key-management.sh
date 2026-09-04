#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  echo ".env 파일이 없습니다." >&2
  exit 1
fi

exec node --env-file=.env scripts/migrate-control-db.mjs
