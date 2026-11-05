import type { NginxSiteConfiguration } from '../../domain/types/nginx-site.type';

/**
 * 호스트 TCP 프록시(HAProxy)가 PROXY protocol 헤더를 붙여 넘기는 컨테이너 안 포트.
 * 기존 80/443 리스너는 그대로 두고 이 포트를 더해, 전환 전후 어느 경로로 들어와도 같은 server 블록이 응답함.
 * 실제 접속 주소는 nginx.conf 의 real_ip_header proxy_protocol 설정으로 $remote_addr 에 들어감.
 */
export const PROXY_PROTOCOL_HTTP_PORT = 8080;
export const PROXY_PROTOCOL_HTTPS_PORT = 8443;

const HTTP_LISTENERS = `    listen 80;
    listen ${PROXY_PROTOCOL_HTTP_PORT} proxy_protocol;`;

const HTTPS_LISTENERS = `    listen 443 ssl;
    listen ${PROXY_PROTOCOL_HTTPS_PORT} ssl proxy_protocol;`;

/** 사이트 구성값으로 conf.d 에 쓸 nginx server 블록 문자열을 만듦. */
export function renderNginxSiteConfig(
  configuration: NginxSiteConfiguration,
): string {
  const sslCert =
    configuration.sslCert ||
    `/etc/nginx/ssl/${configuration.domain}/fullchain.pem`;
  const sslKey =
    configuration.sslKey ||
    `/etc/nginx/ssl/${configuration.domain}/privkey.pem`;

  const wsBlock = configuration.websocket
    ? `
    location /socket.io/ {
        proxy_pass ${configuration.upstream};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }`
    : '';

  const proxyHeaders = `
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;`;

  if (!configuration.ssl) {
    return `server {
${HTTP_LISTENERS}
    server_name ${configuration.domain};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass ${configuration.upstream};${proxyHeaders}
    }${wsBlock}
}
`;
  }

  return `# HTTP → HTTPS 리다이렉트
server {
${HTTP_LISTENERS}
    server_name ${configuration.domain};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS
server {
${HTTPS_LISTENERS}
    http2 on;
    server_name ${configuration.domain};

    ssl_certificate ${sslCert};
    ssl_certificate_key ${sslKey};

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 20M;

    location / {
        proxy_pass ${configuration.upstream};${proxyHeaders}
    }${wsBlock}
}
`;
}
