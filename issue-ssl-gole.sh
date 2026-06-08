#!/bin/bash
# gole.kscold.com SSL 인증서 발급 + HTTPS 전환 스크립트
# 가비아에서 A 레코드(gole → 218.39.220.230) 등록 후 실행하세요.
#
#   cd /Users/kscold/Desktop/kscold-control && ./issue-ssl-gole.sh

set -e
DOMAIN="gole.kscold.com"
EMAIL="developerkscold@gmail.com"
DOCKER_HOST="unix:///Users/kscold/.colima/default/docker.sock"
CONF="/Users/kscold/Desktop/kscold-control/nginx/conf.d/${DOMAIN}.conf"
SSL_DIR="/Users/kscold/Desktop/kscold-control/ssl/${DOMAIN}"

echo "=== 1) DNS 전파 확인 ==="
RESOLVED=$(dig +short $DOMAIN @8.8.8.8 2>/dev/null | tail -1)
MY_IP=$(curl -s https://ipinfo.io/ip)
if [ "$RESOLVED" != "$MY_IP" ]; then
  echo "❌ DNS 미전파: $DOMAIN → ${RESOLVED:-(없음)} (기대: $MY_IP)"
  echo "   가비아에서 A 레코드 등록 후 전파(보통 수분~수십분)를 기다렸다가 다시 실행하세요."
  exit 1
fi
echo "✅ DNS 확인: $DOMAIN → $RESOLVED"

echo ""
echo "=== 2) Let's Encrypt 인증서 발급 (webroot) ==="
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
echo "=== 3) 인증서 복사 (docker cat 트릭, root 소유 파일) ==="
mkdir -p "$SSL_DIR"
for f in fullchain.pem privkey.pem; do
  DOCKER_HOST=$DOCKER_HOST docker run --rm \
    -v /etc/letsencrypt:/etc/letsencrypt \
    --entrypoint cat certbot/certbot \
    "/etc/letsencrypt/live/${DOMAIN}/${f}" > "${SSL_DIR}/${f}"
done
chmod 644 "${SSL_DIR}"/*.pem
echo "✅ 인증서 복사 완료: $SSL_DIR"

echo ""
echo "=== 4) nginx 설정을 HTTPS 풀 설정으로 교체 ==="
cat > "$CONF" <<'NGINX'
# gole.kscold.com — GoLe LEGO Marketplace (ubuntu-gole: web:3000 / api:8080)
# HTTPS 적용 완료 (issue-ssl-gole.sh 가 자동 생성).

server {
    listen 80;
    server_name gole.kscold.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl;
    http2 on;
    server_name gole.kscold.com;

    ssl_certificate     /etc/nginx/ssl/gole.kscold.com/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/gole.kscold.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 50M;

    location /api/ {
        proxy_pass http://ubuntu-gole:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /actuator/ {
        proxy_pass http://ubuntu-gole:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://ubuntu-gole:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX
echo "✅ HTTPS 설정 적용"

echo ""
echo "=== 5) nginx 검증 + 리로드 ==="
DOCKER_HOST=$DOCKER_HOST docker exec kscold-nginx sh -c "nginx -t && nginx -s reload"
echo "✅ nginx 리로드 완료"

echo ""
echo "🎉 https://$DOMAIN 접속 가능!"
