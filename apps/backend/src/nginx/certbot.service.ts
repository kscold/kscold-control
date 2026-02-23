import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

const SSL_DIR = path.resolve(__dirname, '../../../../ssl');
const COMPOSE_DIR = path.resolve(__dirname, '../../../../');

export interface CertInfo {
  domain: string;
  exists: boolean;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  daysLeft?: number;
}

@Injectable()
export class CertbotService {
  private readonly logger = new Logger(CertbotService.name);

  constructor() {
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

    // Certbot webroot volume name (compose project prefix + volume name)
    const webrootVolume = 'kscold-control_certbot-webroot';

    // Run certbot in a one-off container
    const cmd = [
      'docker run --rm',
      `--name certbot-${domain.replace(/\./g, '-')}`,
      `-v ${webrootVolume}:/var/www/certbot`,
      `-v "${SSL_DIR}:/etc/ssl-output"`,
      'certbot/certbot certonly',
      '--webroot',
      '-w /var/www/certbot',
      `-d ${domain}`,
      `--email ${email}`,
      '--agree-tos',
      '--non-interactive',
      '--cert-name temp-cert',
    ].join(' ');

    try {
      const { stdout, stderr } = await execAsync(cmd, {
        timeout: 120000,
        cwd: COMPOSE_DIR,
      });
      const output = stdout + stderr;
      this.logger.log(`Certbot output: ${output}`);

      // Copy certificates to our ssl directory structure
      await this.copyCertFromCertbot(domain);

      // Reload nginx to pick up new cert
      await this.reloadNginx();

      return { success: true, output };
    } catch (error: any) {
      const output = error.stdout + error.stderr || error.message;
      this.logger.error(`Certbot failed: ${output}`);

      // Even if certbot command "failed", check if certs were created
      // (certbot sometimes exits non-zero with warnings)
      try {
        await this.copyCertFromCertbot(domain);
        await this.reloadNginx();
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
      `-v certbot-letsencrypt:/etc/letsencrypt`,
      'certbot/certbot renew',
      '--webroot',
      '-w /var/www/certbot',
      '--non-interactive',
    ].join(' ');

    try {
      const { stdout, stderr } = await execAsync(cmd, { timeout: 300000 });
      const output = stdout + stderr;

      // Copy renewed certs
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

      await this.reloadNginx();
      return { success: true, output };
    } catch (error: any) {
      return { success: false, output: error.message };
    }
  }

  /**
   * Issue cert using standalone mode (for domains not yet proxied by nginx)
   * Temporarily stops nginx, runs certbot standalone, then starts nginx again
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

    // Use docker certbot with host network to bind port 80
    // First stop nginx to free port 80
    try {
      await execAsync('docker stop kscold-nginx', { timeout: 15000 });
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

      // Restart nginx
      await execAsync('docker start kscold-nginx', { timeout: 15000 });

      return { success: true, output };
    } catch (error: any) {
      // Always try to restart nginx
      try {
        await execAsync('docker start kscold-nginx', { timeout: 15000 });
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

    // Try to extract from a temp certbot container
    const cmd = [
      'docker run --rm',
      '-v certbot-letsencrypt:/etc/letsencrypt:ro',
      `-v "${domainDir}:/output"`,
      'alpine sh -c',
      `"cp /etc/letsencrypt/live/temp-cert/fullchain.pem /output/fullchain.pem 2>/dev/null || cp /etc/letsencrypt/live/${domain}/fullchain.pem /output/fullchain.pem && cp /etc/letsencrypt/live/temp-cert/privkey.pem /output/privkey.pem 2>/dev/null || cp /etc/letsencrypt/live/${domain}/privkey.pem /output/privkey.pem"`,
    ].join(' ');

    await execAsync(cmd, { timeout: 30000 });
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

  private async reloadNginx(): Promise<void> {
    try {
      await execAsync('docker exec kscold-nginx nginx -s reload', {
        timeout: 10000,
      });
    } catch (error) {
      this.logger.error('Failed to reload nginx after cert update');
    }
  }
}
