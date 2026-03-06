#!/bin/bash
# congbang.kscold.com SSL 인증서 발급 스크립트
# 가비아에서 DNS A 레코드 등록 후 실행

set -e
DOMAIN="congbang.kscold.com"
EMAIL="developerkscold@gmail.com"
DOCKER_HOST="unix:///Users/kscold/.colima/default/docker.sock"

echo "=== DNS 전파 확인 ==="
RESOLVED=$(dig +short $DOMAIN @8.8.8.8 2>/dev/null | tail -1)
MY_IP=$(curl -s https://ipinfo.io/ip)
if [ "$RESOLVED" != "$MY_IP" ]; then
  echo "❌ DNS 미전파: $DOMAIN → $RESOLVED (기대: $MY_IP)"
  echo "   가비아에서 A 레코드를 확인하고 DNS 전파 후 다시 실행하세요."
  exit 1
fi
echo "✅ DNS 확인: $DOMAIN → $RESOLVED"

echo ""
echo "=== Let's Encrypt 인증서 발급 ==="
DOCKER_HOST=$DOCKER_HOST docker run --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/lib/letsencrypt:/var/lib/letsencrypt \
  -v kscold-control_certbot-webroot:/var/www/certbot \
  certbot/certbot certonly \
    --webroot -w /var/www/certbot \
    -d $DOMAIN \
    --email $EMAIL \
    --agree-tos \
    --non-interactive \
    --expand

echo ""
echo "=== 인증서 복사 ==="
mkdir -p /Users/kscold/Desktop/kscold-control/ssl/$DOMAIN
cp -L /etc/letsencrypt/live/$DOMAIN/fullchain.pem /Users/kscold/Desktop/kscold-control/ssl/$DOMAIN/
cp -L /etc/letsencrypt/live/$DOMAIN/privkey.pem /Users/kscold/Desktop/kscold-control/ssl/$DOMAIN/
chmod 644 /Users/kscold/Desktop/kscold-control/ssl/$DOMAIN/*.pem
echo "✅ SSL 인증서 복사 완료"

echo ""
echo "=== nginx 리로드 ==="
DOCKER_HOST=$DOCKER_HOST docker exec kscold-nginx sh -c "nginx -t && nginx -s reload"
echo "✅ nginx 리로드 완료"

echo ""
echo "=== 완료 ==="
echo "🎉 https://$DOMAIN 접속 가능!"
