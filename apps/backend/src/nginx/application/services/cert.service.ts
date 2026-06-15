import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
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
const RENEWAL_STATUS_FILE = path.join(SSL_DIR, '.renewal-status.json');

/** 인증서 자동 갱신 마지막 실행 결과 */
export interface RenewalStatus {
  lastRunAt: string | null; // ISO
  trigger: 'schedule' | 'manual' | null;
  success: boolean | null;
  renewedDomains: string[]; // 이번 실행에서 실제 갱신된 도메인
  message: string;
  // 실행 시점 기준 인증서 요약 (만료 임박 가시화)
  certs: Array<{ domain: string; daysLeft: number | null }>;
}

@Injectable()
export class CertService {
  private readonly logger = new Logger(CertService.name);

  /** 만료 며칠 전부터 "임박"으로 경고할지 */
  private readonly NEAR_EXPIRY_DAYS = 21;

  constructor(
    @Inject(NGINX_RUNTIME_REPOSITORY)
    private readonly runtimeRepo: INginxRuntimeRepository,
  ) {
    if (!fs.existsSync(SSL_DIR)) {
      fs.mkdirSync(SSL_DIR, { recursive: true });
    }
  }

  /**
   * SSL 인증서 자동 갱신 — 매일 04:10 (KST).
   * certbot renew는 만료 30일 이내 인증서만 실제 갱신하므로 매일 실행해도 안전하다.
   * 갱신된 인증서는 renewAll() 내부에서 ssl/로 복사되고 nginx가 reload된다.
   */
  @Cron('10 4 * * *', { name: 'ssl-auto-renew', timeZone: 'Asia/Seoul' })
  async handleScheduledRenewal(): Promise<void> {
    this.logger.log('[SSL 자동 갱신] 스케줄 실행 시작');
    await this.runRenewal('schedule');
  }

  /**
   * 갱신 실행 + 마지막 결과 영속화. 수동/스케줄 공용.
   */
  async runRenewal(
    trigger: 'schedule' | 'manual',
  ): Promise<{ success: boolean; output: string }> {
    const before = await this.listCerts();
    const result = await this.renewAll();
    const after = await this.listCerts();

    // certbot 출력에서 실제 갱신된 도메인 추출 (없으면 만료일이 늘어난 도메인으로 추정)
    const renewedDomains = this.detectRenewedDomains(
      result.output,
      before,
      after,
    );

    const nearExpiry = after.filter(
      (c) =>
        typeof c.daysLeft === 'number' && c.daysLeft <= this.NEAR_EXPIRY_DAYS,
    );
    if (nearExpiry.length > 0) {
      this.logger.warn(
        `[SSL 자동 갱신] 만료 임박(≤${this.NEAR_EXPIRY_DAYS}일): ` +
          nearExpiry.map((c) => `${c.domain}(${c.daysLeft}d)`).join(', '),
      );
    }

    const status: RenewalStatus = {
      lastRunAt: new Date().toISOString(),
      trigger,
      success: result.success,
      renewedDomains,
      message: result.success
        ? renewedDomains.length > 0
          ? `${renewedDomains.length}개 인증서를 갱신했습니다: ${renewedDomains.join(', ')}`
          : '갱신 대상(만료 임박) 인증서가 없습니다. 모두 최신 상태입니다.'
        : `갱신 실패: ${result.output.slice(0, 300)}`,
      certs: after.map((c) => ({
        domain: c.domain,
        daysLeft: c.daysLeft ?? null,
      })),
    };
    this.writeRenewalStatus(status);
    this.logger.log(`[SSL 자동 갱신] 완료 — ${status.message}`);

    return result;
  }

  /** 마지막 자동/수동 갱신 실행 결과 조회 */
  getRenewalStatus(): RenewalStatus {
    try {
      if (fs.existsSync(RENEWAL_STATUS_FILE)) {
        return JSON.parse(fs.readFileSync(RENEWAL_STATUS_FILE, 'utf8'));
      }
    } catch {
      // 무시하고 기본값 반환
    }
    return {
      lastRunAt: null,
      trigger: null,
      success: null,
      renewedDomains: [],
      message:
        '아직 자동 갱신이 실행되지 않았습니다. 매일 04:10(KST)에 실행됩니다.',
      certs: [],
    };
  }

  private writeRenewalStatus(status: RenewalStatus): void {
    try {
      fs.writeFileSync(RENEWAL_STATUS_FILE, JSON.stringify(status, null, 2), {
        mode: 0o644,
      });
    } catch (error) {
      this.logger.error(`갱신 상태 저장 실패: ${(error as Error).message}`);
    }
  }

  private detectRenewedDomains(
    output: string,
    before: CertInfo[],
    after: CertInfo[],
  ): string[] {
    // certbot은 갱신 시 "Congratulations, all renewals succeeded: .../live/<domain>/..." 출력
    const fromOutput = new Set<string>();
    const re = /live\/([^/\s]+)\/fullchain\.pem.*\(success\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(output)) !== null) fromOutput.add(m[1]);

    // 보강: 만료일(daysLeft)이 증가한 도메인
    const beforeMap = new Map(before.map((c) => [c.domain, c.daysLeft ?? -1]));
    for (const c of after) {
      const prev = beforeMap.get(c.domain) ?? -1;
      if (typeof c.daysLeft === 'number' && c.daysLeft > prev + 1) {
        fromOutput.add(c.domain);
      }
    }
    return [...fromOutput];
  }

  /**
   * List all SSL certificates in the ssl directory
   */
  async listCerts(): Promise<CertInfo[]> {
    const certs: CertInfo[] = [];

    if (!fs.existsSync(SSL_DIR)) return certs;

    // ssl/ 안에는 도메인 폴더 외에 certbot/letsencrypt 메타 디렉토리가
    // 섞여 있을 수 있어 제외한다. (도메인은 항상 '.'을 포함)
    const LETSENCRYPT_META = new Set([
      'accounts',
      'archive',
      'live',
      'renewal',
      'renewal-hooks',
      'csr',
      'keys',
    ]);

    const dirs = fs.readdirSync(SSL_DIR, { withFileTypes: true });
    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;
      if (LETSENCRYPT_META.has(dir.name) || !dir.name.includes('.')) continue;

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
