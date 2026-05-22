import { Injectable, Inject, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import type { CertInfo } from '../../domain/types/nginx-site.type';
import type { INginxRuntimeRepository } from '../../domain/interfaces/nginx-runtime.repository';
import { NGINX_RUNTIME_REPOSITORY } from '../../domain/interfaces/nginx-runtime.repository';

const execAsync = promisify(exec);

const SSL_DIR = path.resolve(__dirname, '../../../../../../ssl');
const COMPOSE_DIR = path.resolve(__dirname, '../../../../../../');
const LETSENCRYPT_DIR = '/etc/letsencrypt';
const LETSENCRYPT_LIB_DIR = '/var/lib/letsencrypt';

@Injectable()
export class CertService {
  private readonly logger = new Logger(CertService.name);

  constructor(
    @Inject(NGINX_RUNTIME_REPOSITORY)
    private readonly runtimeRepo: INginxRuntimeRepository,
  ) {
    if (!fs.existsSync(SSL_DIR)) {
      fs.mkdirSync(SSL_DIR, { recursive: true });
    }
  }

  /**
   * List all SSL certificates in the ssl directory
   */
  async listCerts(): Promise<CertInfo[]> {
    const certs: CertInfo[] = [];

    if (!fs.existsSync(SSL_DIR)) return certs;

    const dirs = fs.readdirSync(SSL_DIR, { withFileTypes: true });
    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;

      const domain = dir.name;
      const certPath = path.join(SSL_DIR, domain, 'fullchain.pem');

      if (!fs.existsSync(certPath)) {
        certs.push({ domain, exists: false });
        continue;
      }

      try {
        const info = await this.getCertInfo(certPath);
        certs.push({ domain, exists: true, ...info });
      } catch {
        certs.push({ domain, exists: true });
      }
    }

    return certs;
  }

  /**
   * Issue a new SSL certificate using certbot via Docker
   * Uses webroot mode with the shared certbot-webroot volume
   */
  async issueCert(
    domain: string,
    email: string,
  ): Promise<{ success: boolean; output: string }> {
    this.logger.log(`Issuing SSL cert for ${domain}`);

    const webrootVolume = 'kscold-control_certbot-webroot';

    const cmd = [
      'docker run --rm',
      `--name certbot-${domain.replace(/\./g, '-')}`,
      `-v ${webrootVolume}:/var/www/certbot`,
      `-v "${LETSENCRYPT_DIR}:${LETSENCRYPT_DIR}"`,
      `-v "${LETSENCRYPT_LIB_DIR}:${LETSENCRYPT_LIB_DIR}"`,
      'certbot/certbot certonly',
      '--webroot',
      '-w /var/www/certbot',
      `-d ${domain}`,
      `--email ${email}`,
      '--agree-tos',
      '--non-interactive',
      `--cert-name ${domain}`,
    ].join(' ');

    try {
      const { stdout, stderr } = await execAsync(cmd, {
        timeout: 120000,
        cwd: COMPOSE_DIR,
      });
      const output = stdout + stderr;
      this.logger.log(`Certbot output: ${output}`);

      await this.copyCertFromCertbot(domain);
      await this.runtimeRepo.reload();

      return { success: true, output };
    } catch (error: any) {
      const output = error.stdout + error.stderr || error.message;
      this.logger.error(`Certbot failed: ${output}`);

      try {
        await this.copyCertFromCertbot(domain);
        await this.runtimeRepo.reload();
        return {
          success: true,
          output: output + '\n(Certificates were issued despite warnings)',
        };
      } catch {
        return { success: false, output };
      }
    }
  }

  /**
   * Renew all certificates
   */
  async renewAll(): Promise<{ success: boolean; output: string }> {
    const webrootVolume = 'kscold-control_certbot-webroot';

    const cmd = [
      'docker run --rm',
      '--name certbot-renew',
      `-v ${webrootVolume}:/var/www/certbot`,
      `-v "${LETSENCRYPT_DIR}:${LETSENCRYPT_DIR}"`,
      `-v "${LETSENCRYPT_LIB_DIR}:${LETSENCRYPT_LIB_DIR}"`,
      'certbot/certbot renew',
      '--webroot',
      '-w /var/www/certbot',
      '--non-interactive',
    ].join(' ');

    try {
      const { stdout, stderr } = await execAsync(cmd, { timeout: 300000 });
      const output = stdout + stderr;

      const certs = await this.listCerts();
      for (const cert of certs) {
        if (cert.exists) {
          try {
            await this.copyCertFromCertbot(cert.domain);
          } catch {
            // Individual cert copy failures shouldn't stop renewal
          }
        }
      }

      await this.runtimeRepo.reload();
      return { success: true, output };
    } catch (error: any) {
      return { success: false, output: error.message };
    }
  }

  /**
   * Issue cert using standalone mode (for domains not yet proxied by nginx)
   */
  async issueCertStandalone(
    domain: string,
    email: string,
  ): Promise<{ success: boolean; output: string }> {
    this.logger.log(`Issuing SSL cert (standalone) for ${domain}`);

    const domainDir = path.join(SSL_DIR, domain);
    if (!fs.existsSync(domainDir)) {
      fs.mkdirSync(domainDir, { recursive: true });
    }

    try {
      await this.runtimeRepo.stop();
    } catch {
      // nginx might not be running
    }

    const cmd = [
      'docker run --rm',
      `--name certbot-standalone-${domain.replace(/\./g, '-')}`,
      '--network host',
      `-v "${domainDir}:/etc/ssl-output"`,
      'certbot/certbot certonly',
      '--standalone',
      `-d ${domain}`,
      `--email ${email}`,
      '--agree-tos',
      '--non-interactive',
      `--fullchain-path /etc/ssl-output/fullchain.pem`,
      `--key-path /etc/ssl-output/privkey.pem`,
      `--cert-path /etc/ssl-output/cert.pem`,
    ].join(' ');

    try {
      const { stdout, stderr } = await execAsync(cmd, { timeout: 120000 });
      const output = stdout + stderr;

      await this.runtimeRepo.start();

      return { success: true, output };
    } catch (error: any) {
      try {
        await this.runtimeRepo.start();
      } catch {
        this.logger.error('Failed to restart nginx after certbot');
      }

      return {
        success: false,
        output: error.stdout + error.stderr || error.message,
      };
    }
  }

  /**
   * Copy certbot-issued certs to our ssl directory structure
   */
  private async copyCertFromCertbot(domain: string): Promise<void> {
    const domainDir = path.join(SSL_DIR, domain);
    if (!fs.existsSync(domainDir)) {
      fs.mkdirSync(domainDir, { recursive: true });
    }

    // Docker certbot runs as root, so it can read /etc/letsencrypt even when
    // macOS file permissions would block the Node process. Pipe via stdout
    // so write happens in the Node process (which owns the ssl/ files).
    const liveDir = path.join(LETSENCRYPT_DIR, 'live', domain);
    const dockerHost = process.env.DOCKER_HOST || 'unix:///var/run/docker.sock';

    for (const file of ['fullchain.pem', 'privkey.pem']) {
      const src = path.join(liveDir, file);
      const dest = path.join(domainDir, file);
      const cmd = `DOCKER_HOST=${dockerHost} docker run --rm -v "${LETSENCRYPT_DIR}:${LETSENCRYPT_DIR}" --entrypoint cat certbot/certbot "${src}"`;
      const { stdout } = await execAsync(cmd);
      if (!stdout) throw new Error(`빈 인증서 출력: ${domain}/${file}`);
      fs.writeFileSync(dest, stdout, { mode: 0o644 });
    }
  }

  /**
   * Get certificate details using openssl
   */
  private async getCertInfo(
    certPath: string,
  ): Promise<Omit<CertInfo, 'domain' | 'exists'>> {
    try {
      const { stdout } = await execAsync(
        `openssl x509 -in "${certPath}" -noout -issuer -dates 2>/dev/null`,
      );

      const issuerMatch = stdout.match(/issuer=(.+)/);
      const notBeforeMatch = stdout.match(/notBefore=(.+)/);
      const notAfterMatch = stdout.match(/notAfter=(.+)/);

      const validTo = notAfterMatch?.[1]?.trim();
      let daysLeft: number | undefined;

      if (validTo) {
        const expiry = new Date(validTo);
        const now = new Date();
        daysLeft = Math.floor(
          (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
      }

      return {
        issuer: issuerMatch?.[1]?.trim(),
        validFrom: notBeforeMatch?.[1]?.trim(),
        validTo,
        daysLeft,
      };
    } catch {
      return {};
    }
  }
}
