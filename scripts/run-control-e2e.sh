#!/bin/bash

set -euo pipefail

ROOT_DIR="/Users/kscold/Desktop/kscold-control"
BACKEND_DIR="$ROOT_DIR/apps/backend"
BACKEND_LOG_FILE="${TMPDIR:-/tmp}/kscold-control-e2e-backend.log"
BACKEND_PORT="4410"
BACKEND_PID=""
E2E_FRONTEND_DIR=""

cleanup() {
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
  if [[ -n "$E2E_FRONTEND_DIR" && "$E2E_FRONTEND_DIR" == "${TMPDIR:-/tmp}/kscold-control-e2e-frontend."* ]]; then
    rm -rf -- "$E2E_FRONTEND_DIR"
  fi
}

trap cleanup EXIT

cd "$ROOT_DIR"

pnpm --filter @kscold-control/backend build
pnpm --filter @kscold-control/frontend build

E2E_FRONTEND_DIR="$(mktemp -d "${TMPDIR:-/tmp}/kscold-control-e2e-frontend.XXXXXX")"
cp -R "$ROOT_DIR/apps/frontend/dist/." "$E2E_FRONTEND_DIR/"

cd "$BACKEND_DIR"
DOCKER_HOST="unix:///Users/kscold/.colima/default/docker.sock" \
NODE_ENV="production" \
PORT="$BACKEND_PORT" \
CONTROL_FRONTEND_DIST_PATH="$E2E_FRONTEND_DIR" \
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

if ! curl -fsS "http://127.0.0.1:${BACKEND_PORT}/keys" | grep -q '<div id="root"></div>'; then
  echo "E2E 백엔드가 SPA 직접 경로를 제공하지 못했습니다. 로그: $BACKEND_LOG_FILE" >&2
  exit 1
fi

cd "$ROOT_DIR"
pnpm exec playwright test
