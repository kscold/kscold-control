import * as fs from 'fs';
import * as path from 'path';
import {
  PROXY_PROTOCOL_HTTP_PORT,
  PROXY_PROTOCOL_HTTPS_PORT,
  renderNginxSiteConfig,
} from '@/nginx/infrastructure/lib/nginx-site-config.template';

const REPOSITORY_ROOT = path.resolve(__dirname, '../../../../../../..');

/** 생성된 설정을 server 블록 단위로 나눔. 중첩 블록은 location 하나 깊이까지만 다룸. */
function serverBlocks(config: string): string[] {
  return config.split(/^server \{$/m).slice(1);
}

describe('renderNginxSiteConfig', () => {
  const base = {
    name: 'app',
    domain: 'app.example.com',
    upstream: 'http://ubuntu-app:3000',
    websocket: false,
  };

  it('HTTPS 사이트는 기존 80/443 옆에 PROXY protocol 리스너를 함께 둠', () => {
    const config = renderNginxSiteConfig({ ...base, ssl: true });
    const [httpBlock, httpsBlock] = serverBlocks(config);

    expect(PROXY_PROTOCOL_HTTP_PORT).toBe(8080);
    expect(PROXY_PROTOCOL_HTTPS_PORT).toBe(8443);
    expect(httpBlock).toContain('    listen 80;\n');
    expect(httpBlock).toContain('    listen 8080 proxy_protocol;\n');
    expect(httpsBlock).toContain('    listen 443 ssl;\n');
    expect(httpsBlock).toContain('    listen 8443 ssl proxy_protocol;\n');
    expect(httpsBlock).toContain('    http2 on;\n');
    // 사이트 목록 화면은 이 문자열로 SSL 여부를 판별함
    expect(config).toContain('listen 443 ssl');
  });

  it('인증서 갱신용 acme-challenge 위치가 PROXY protocol HTTP 리스너와 같은 블록에 있음', () => {
    for (const ssl of [true, false]) {
      const [httpBlock] = serverBlocks(renderNginxSiteConfig({ ...base, ssl }));

      expect(httpBlock).toContain('listen 8080 proxy_protocol;');
      expect(httpBlock).toContain('location /.well-known/acme-challenge/ {');
      expect(httpBlock).toContain('root /var/www/certbot;');
    }
  });

  it('HTTP 전용 사이트에는 HTTPS 리스너를 만들지 않음', () => {
    const config = renderNginxSiteConfig({ ...base, ssl: false });

    expect(serverBlocks(config)).toHaveLength(1);
    expect(config).toContain('listen 8080 proxy_protocol;');
    expect(config).not.toContain('443');
    expect(config).not.toContain('8443');
  });

  it('앱에는 실제 접속 주소가 담긴 $remote_addr 를 X-Real-IP·X-Forwarded-For 로 넘김', () => {
    const config = renderNginxSiteConfig({
      ...base,
      ssl: true,
      websocket: true,
    });

    expect(
      config.match(/proxy_set_header X-Real-IP \$remote_addr;/g),
    ).toHaveLength(2);
    expect(
      config.match(
        /proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;/g,
      ),
    ).toHaveLength(2);
  });
});

describe('저장소 nginx 설정의 실제 접속 주소 계약', () => {
  const read = (relativePath: string) =>
    fs.readFileSync(path.join(REPOSITORY_ROOT, relativePath), 'utf-8');

  it('nginx.conf 는 PROXY protocol 주소를 신뢰 대역에서만 $remote_addr 로 바꿈', () => {
    const nginxConf = read('nginx/nginx.conf');

    expect(nginxConf).toMatch(/^\s*set_real_ip_from 172\.16\.0\.0\/12;$/m);
    expect(nginxConf).toMatch(/^\s*set_real_ip_from 127\.0\.0\.1;$/m);
    expect(nginxConf).toMatch(/^\s*real_ip_header proxy_protocol;$/m);
    expect(nginxConf).toMatch(/^\s*real_ip_recursive on;$/m);
    // 컨테이너 안 포트(8080/8443)가 리다이렉트 주소에 새지 않아야 함
    expect(nginxConf).toMatch(/^\s*port_in_redirect off;$/m);
  });

  it('공개 템플릿도 생성기와 같은 리스너 구성을 따름', () => {
    const example = read('nginx/conf.d/app-stack.conf.example');

    expect(example).toContain('listen 8080 proxy_protocol;');
    expect(example).toContain('listen 8443 ssl proxy_protocol;');
  });
});
