#!/bin/bash

set -euo pipefail

ROOT_DIR="/Users/kscold/Desktop/kscold-control"
BACKEND_DIR="$ROOT_DIR/apps/backend"
BACKEND_LOG_FILE="${TMPDIR:-/tmp}/kscold-control-e2e-backend.log"
BACKEND_PORT="4410"
BACKEND_PID=""

cleanup() {
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT

cd "$ROOT_DIR"

pnpm --filter @kscold-control/backend build

cd "$BACKEND_DIR"
DATABASE_URL="postgresql://admin:admin123@localhost:5432/kscold-infra-db" \
DOCKER_HOST="unix:///Users/kscold/.colima/default/docker.sock" \
PORT="$BACKEND_PORT" \
node -r dotenv/config dist/main.js dotenv_config_path="$ROOT_DIR/.env" \
  >"$BACKEND_LOG_FILE" 2>&1 &
BACKEND_PID=$!

for _ in $(seq 1 60); do
  if curl -s -o /dev/null "http://127.0.0.1:${BACKEND_PORT}/api/auth/me"; then
    break
  fi
  sleep 1
done

if ! curl -s -o /dev/null "http://127.0.0.1:${BACKEND_PORT}/api/auth/me"; then
  echo "E2E 백엔드를 기동하지 못했습니다. 로그: $BACKEND_LOG_FILE" >&2
  exit 1
fi

cd "$ROOT_DIR"
pnpm exec playwright test
