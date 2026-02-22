#!/bin/bash
set -e

echo "=== SSL 인증서 복사 시작 ==="

# 디렉토리 생성
mkdir -p /Users/kscold/Desktop/kscold-control/ssl/galjido.kscold.com
mkdir -p /Users/kscold/Desktop/kscold-control/ssl/control.kscold.com

# galjido 인증서 복사 (심볼릭 링크 따라가기)
cp -L /etc/letsencrypt/live/galjido.kscold.com/fullchain.pem /Users/kscold/Desktop/kscold-control/ssl/galjido.kscold.com/
cp -L /etc/letsencrypt/live/galjido.kscold.com/privkey.pem /Users/kscold/Desktop/kscold-control/ssl/galjido.kscold.com/
echo "  galjido.kscold.com 완료"

# control 인증서 복사
cp -L /etc/letsencrypt/live/control.kscold.com/fullchain.pem /Users/kscold/Desktop/kscold-control/ssl/control.kscold.com/
cp -L /etc/letsencrypt/live/control.kscold.com/privkey.pem /Users/kscold/Desktop/kscold-control/ssl/control.kscold.com/
echo "  control.kscold.com 완료"

# 소유권 변경
chown -R kscold /Users/kscold/Desktop/kscold-control/ssl/
chmod -R 644 /Users/kscold/Desktop/kscold-control/ssl/
chmod 755 /Users/kscold/Desktop/kscold-control/ssl /Users/kscold/Desktop/kscold-control/ssl/galjido.kscold.com /Users/kscold/Desktop/kscold-control/ssl/control.kscold.com

echo "=== SSL 인증서 복사 완료 ==="
