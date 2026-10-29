#!/usr/bin/env bash
set -euo pipefail
[[ ! -e /run/gadoc-env-apply-blocked && ! -L /run/gadoc-env-apply-blocked ]] || exit 1
kill -0 "$(cat /run/mongodb/mongod.pid)"
kill -0 "$(cat /run/sshd.pid)"
if [[ "${GADOC_START_RUNTIME:-0}" == 1 ]]; then
    curl -fsS --max-time 3 http://127.0.0.1:8082/api/health >/dev/null
    curl -fsS --max-time 3 http://127.0.0.1:3002/auth/login >/dev/null
fi
