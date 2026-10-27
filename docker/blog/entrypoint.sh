#!/bin/bash
set -euo pipefail
mkdir -p /run/blog
chmod 700 /run/blog
# 기존 root 소유 MongoDB/업로드는 운영자가 정지 후 명시적으로 권한을 이전한다.
# 시작할 때 운영 데이터 소유권이나 FCV를 암묵적으로 변경하지 않는다.
exec /usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf
