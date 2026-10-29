#!/bin/sh
# kscold-control KMS 전용 강제 명령 (root authorized_keys 의 새 키 한 줄에만 지정)
# GaDoc 저장소 scripts/deploy/env-ssh-entrypoint.sh 와 같은 내용이다. 이미지에 넣어 컨테이너를 다시 만들어도 남게 한다.
# 입력을 셸로 해석하지 않고, Node 를 띄우기 전에 환경을 비워 NODE_OPTIONS·LD_PRELOAD 주입을 막는다.
set -eu
umask 077
[ "$#" -eq 0 ] || exit 64

exec /usr/bin/env -i \
  PATH=/usr/local/bin:/usr/bin:/bin \
  HOME=/root PM2_HOME=/root/.pm2 \
  SSH_ORIGINAL_COMMAND="${SSH_ORIGINAL_COMMAND:-}" \
  /usr/local/bin/node /app/slacord-deploy/tools/env-management.mjs
