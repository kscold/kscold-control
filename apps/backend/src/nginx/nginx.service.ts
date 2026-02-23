import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

// Docker nginx 컨테이너의 설정 디렉토리 (호스트에서 마운트됨)
const NGINX_CONF_DIR = path.resolve(__dirname, '../../../../nginx/conf.d');
// SSL 인증서 디렉토리 (호스트 기준)
const SSL_DIR = path.resolve(__dirname, '../../../../ssl');
// Docker nginx 컨테이너 이름
const NGINX_CONTAINER = 'kscold-nginx';

export interface NginxSite {
  name: string;
  domain: string;
  upstream: string;
  ssl: boolean;
  sslCert: string;
  sslKey: string;
  websocket: boolean;
  enabled: boolean;
  raw?: string;
}

export interface CreateNginxSiteDto {
  name: string;
  domain: string;
  upstream: string;
  ssl: boolean;
  sslCert?: string;
  sslKey?: string;
  websocket: boolean;
}

@Injectable()
export class NginxService {
  private readonly logger = new Logger(NginxService.name);

  constructor() {
    // 디렉토리가 없으면 생성
    if (!fs.existsSync(NGINX_CONF_DIR)) {
      fs.mkdirSync(NGINX_CONF_DIR, { recursive: true });
    }
  }

  /**
   * 모든 사이트 목록 조회
   */
  async listSites(): Promise<NginxSite[]> {
    const files = fs.readdirSync(NGINX_CONF_DIR);
    const sites: NginxSite[] = [];

    for (const file of files) {
      const enabled = file.endsWith('.conf');
      const disabled = file.endsWith('.conf.disabled');
      if (!enabled && !disabled) continue;

      const filePath = path.join(NGINX_CONF_DIR, file);
      const raw = fs.readFileSync(filePath, 'utf-8');
      const name = file.replace('.conf.disabled', '').replace('.conf', '');

      sites.push({ ...this.parseConfig(raw, name), enabled, raw });
    }

    return sites;
  }

  /**
   * 사이트 생성
   */
  async createSite(dto: CreateNginxSiteDto): Promise<NginxSite> {
    const filePath = path.join(NGINX_CONF_DIR, `${dto.name}.conf`);
    if (fs.existsSync(filePath)) {
      throw new Error(`Site "${dto.name}" already exists`);
    }

    const config = this.generateConfig(dto);
    fs.writeFileSync(filePath, config, 'utf-8');

    return {
      ...dto,
      sslCert: dto.sslCert || '',
      sslKey: dto.sslKey || '',
      enabled: true,
    };
  }

  /**
   * 사이트 수정
   */
  async updateSite(name: string, dto: CreateNginxSiteDto): Promise<NginxSite> {
    const filePath = this.getFilePath(name);
    const config = this.generateConfig(dto);
    fs.writeFileSync(filePath, config, 'utf-8');

    return {
      ...dto,
      sslCert: dto.sslCert || '',
      sslKey: dto.sslKey || '',
      enabled: true,
    };
  }

  /**
   * 사이트 삭제
   */
  async deleteSite(name: string): Promise<void> {
    const filePath = this.getFilePath(name);
    fs.unlinkSync(filePath);
  }

  /**
   * 사이트 활성화/비활성화
   */
  async toggleSite(name: string): Promise<{ enabled: boolean }> {
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

  /**
   * Nginx 설정 테스트 (Docker 컨테이너에서 실행)
   */
  async testConfig(): Promise<{ success: boolean; output: string }> {
    try {
      const { stdout, stderr } = await execAsync(
        `docker exec ${NGINX_CONTAINER} nginx -t 2>&1`,
      );
      const output = stdout + stderr;
      return { success: true, output };
    } catch (error) {
      return { success: false, output: error.message };
    }
  }

  /**
   * Nginx 리로드 (Docker 컨테이너에서 실행)
   */
  async reloadNginx(): Promise<{ success: boolean; output: string }> {
    try {
      const { stdout, stderr } = await execAsync(
        `docker exec ${NGINX_CONTAINER} nginx -s reload 2>&1`,
      );
      return { success: true, output: stdout + stderr };
    } catch (error) {
      return { success: false, output: error.message };
    }
  }

  /**
   * 설정 파일 파싱
   */
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

  /**
   * 설정 파일 생성 (Docker nginx용 템플릿)
   * - upstream은 Docker 컨테이너 이름으로 지정 (예: http://ubuntu-galjido:8080)
   * - SSL 인증서는 Docker 내부 경로 (/etc/nginx/ssl/...)
   */
  private generateConfig(dto: CreateNginxSiteDto): string {
    const sslCert = dto.sslCert || `/etc/nginx/ssl/${dto.domain}/fullchain.pem`;
    const sslKey = dto.sslKey || `/etc/nginx/ssl/${dto.domain}/privkey.pem`;

    const wsBlock = dto.websocket
      ? `
    location /socket.io/ {
        proxy_pass ${dto.upstream};
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

    if (!dto.ssl) {
      return `server {
    listen 80;
    server_name ${dto.domain};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass ${dto.upstream};${proxyHeaders}
    }${wsBlock}
}
`;
    }

    return `# HTTP → HTTPS 리다이렉트
server {
    listen 80;
    server_name ${dto.domain};

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
    server_name ${dto.domain};

    ssl_certificate ${sslCert};
    ssl_certificate_key ${sslKey};

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 20M;

    location / {
        proxy_pass ${dto.upstream};${proxyHeaders}
    }${wsBlock}
}
`;
  }

  private getFilePath(name: string): string {
    const enabledPath = path.join(NGINX_CONF_DIR, `${name}.conf`);
    const disabledPath = path.join(NGINX_CONF_DIR, `${name}.conf.disabled`);
    if (fs.existsSync(enabledPath)) return enabledPath;
    if (fs.existsSync(disabledPath)) return disabledPath;
    throw new Error(`Site "${name}" not found`);
  }
}
