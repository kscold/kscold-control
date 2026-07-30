import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type { INginxConfigRepository } from '../../domain/repositories/nginx-config.repository';
import type {
  NginxSite,
  NginxSiteConfiguration,
} from '../../domain/types/nginx-site.type';

const NGINX_CONF_DIR = path.resolve(
  __dirname,
  '../../../../../../nginx/conf.d',
);

@Injectable()
export class NginxConfigRepositoryImpl implements INginxConfigRepository {
  private readonly logger = new Logger(NginxConfigRepositoryImpl.name);

  constructor() {
    if (!fs.existsSync(NGINX_CONF_DIR)) {
      fs.mkdirSync(NGINX_CONF_DIR, { recursive: true });
    }
  }

  async list(): Promise<NginxSite[]> {
    const files = fs.readdirSync(NGINX_CONF_DIR);
    const sites: NginxSite[] = [];

    for (const file of files) {
      const enabled = file.endsWith('.conf');
      const disabled = file.endsWith('.conf.disabled');
      if (!enabled && !disabled) continue;

      const filePath = path.join(NGINX_CONF_DIR, file);
      const raw = fs.readFileSync(filePath, 'utf-8');
      const name = file.replace('.conf.disabled', '').replace('.conf', '');

      const site = { ...this.parseConfig(raw, name), enabled, raw };

      // conf.d 에는 사이트가 아닌 공용 include 도 있다.
      // 예: security 모듈이 생성하는 ip-blocklist.conf (IP 차단 목록).
      // server_name 이 없으면 사이트가 아니므로 목록에서 제외한다.
      // 이 판별은 사이트 개념을 소유한 이 계층의 책임이며,
      // 소비자(토폴로지 등)가 각자 걸러내면 규칙이 흩어져 누락이 생긴다.
      if (!site.domain?.trim()) continue;

      sites.push(site);
    }

    return sites;
  }

  read(name: string): NginxSite | null {
    this.assertSafeName(name);
    const enabledPath = path.join(NGINX_CONF_DIR, `${name}.conf`);
    const disabledPath = path.join(NGINX_CONF_DIR, `${name}.conf.disabled`);

    let filePath: string | null = null;
    let enabled = false;

    if (fs.existsSync(enabledPath)) {
      filePath = enabledPath;
      enabled = true;
    } else if (fs.existsSync(disabledPath)) {
      filePath = disabledPath;
      enabled = false;
    }

    if (!filePath) return null;

    const raw = fs.readFileSync(filePath, 'utf-8');
    return { ...this.parseConfig(raw, name), enabled, raw };
  }

  write(name: string, configuration: NginxSiteConfiguration): NginxSite {
    this.assertSafeName(name);
    const enabledPath = path.join(NGINX_CONF_DIR, `${name}.conf`);
    const disabledPath = path.join(NGINX_CONF_DIR, `${name}.conf.disabled`);

    // 기존 비활성 설정이 있으면 같은 파일을 갱신해야 상태가 바뀌지 않음.
    const existingPath = fs.existsSync(enabledPath)
      ? enabledPath
      : fs.existsSync(disabledPath)
        ? disabledPath
        : null;

    // 기존 파일이 없을 때만 활성 설정 파일을 새로 생성함.
    const filePath = existingPath || enabledPath;
    const config = this.generateConfig(configuration);
    fs.writeFileSync(filePath, config, 'utf-8');

    return {
      ...configuration,
      sslCert: configuration.sslCert || '',
      sslKey: configuration.sslKey || '',
      enabled: true,
    };
  }

  delete(name: string): void {
    this.assertSafeName(name);
    const filePath = this.getFilePath(name);
    fs.unlinkSync(filePath);
  }

  toggle(name: string): { enabled: boolean } {
    this.assertSafeName(name);
    const enabledPath = path.join(NGINX_CONF_DIR, `${name}.conf`);
    const disabledPath = path.join(NGINX_CONF_DIR, `${name}.conf.disabled`);

    if (fs.existsSync(enabledPath)) {
      fs.renameSync(enabledPath, disabledPath);
      return { enabled: false };
    } else if (fs.existsSync(disabledPath)) {
      fs.renameSync(disabledPath, enabledPath);
      return { enabled: true };
    }

    throw new Error(`Site "${name}" not found`);
  }

  private parseConfig(
    raw: string,
    name: string,
  ): Omit<NginxSite, 'enabled' | 'raw'> {
    const domainMatch = raw.match(/server_name\s+([^\s;]+)/);
    const upstreamMatch = raw.match(/proxy_pass\s+(https?:\/\/[^\s;]+)/);
    const sslMatch = raw.includes('listen 443 ssl');
    const certMatch = raw.match(/ssl_certificate\s+([^\s;]+)/);
    const keyMatch = raw.match(/ssl_certificate_key\s+([^\s;]+)/);
    const wsMatch =
      raw.includes('Connection "upgrade"') ||
      raw.includes("Connection 'upgrade'");

    return {
      name,
      domain: domainMatch?.[1] || '',
      upstream: upstreamMatch?.[1] || '',
      ssl: sslMatch,
      sslCert: certMatch?.[1] || '',
      sslKey: keyMatch?.[1] || '',
      websocket: wsMatch,
    };
  }

  private generateConfig(configuration: NginxSiteConfiguration): string {
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
    listen 80;
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
    listen 80;
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
    listen 443 ssl;
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

  private getFilePath(name: string): string {
    this.assertSafeName(name);
    const enabledPath = path.join(NGINX_CONF_DIR, `${name}.conf`);
    const disabledPath = path.join(NGINX_CONF_DIR, `${name}.conf.disabled`);
    if (fs.existsSync(enabledPath)) return enabledPath;
    if (fs.existsSync(disabledPath)) return disabledPath;
    throw new Error(`Site "${name}" not found`);
  }

  private assertSafeName(name: string): void {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,62}$/.test(name)) {
      throw new BadRequestException('사이트 이름이 올바르지 않습니다.');
    }
  }
}
