import {
  BadRequestException,
  Injectable,
  Inject,
  Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import type { CertInfo } from '../../domain/types/nginx-site.type';
import type { INginxRuntimeRepository } from '../../domain/repositories/nginx-runtime.repository';
import { NGINX_RUNTIME_REPOSITORY } from '../../domain/repositories/nginx-runtime.repository';

const execFileAsync = promisify(execFile);

const SSL_DIR = path.resolve(__dirname, '../../../../../../ssl');
const COMPOSE_DIR = path.resolve(__dirname, '../../../../../../');
const LETSENCRYPT_DIR = '/etc/letsencrypt';
const LETSENCRYPT_LIB_DIR = '/var/lib/letsencrypt';
const RENEWAL_STATUS_FILE = path.join(SSL_DIR, '.renewal-status.json');

/** 인증서 자동 갱신 마지막 실행 결과임. */
export interface RenewalStatus {
  lastRunAt: string | null; // ISO 8601 형식 시각임.
  trigger: 'schedule' | 'manual' | null;
  success: boolean | null;
  renewedDomains: string[]; // 이번 실행에서 실제 갱신된 도메인 목록임.
  message: string;
  // 실행 시점 기준 인증서 요약이며 만료 임박 상태 표시에 사용함.
  certs: Array<{ domain: string; daysLeft: number | null }>;
}

@Injectable()
export class CertService {
  private readonly logger = new Logger(CertService.name);

  /** 만료 임박 경고를 시작할 남은 일수임. */
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
   * SSL 인증서를 매일 04:10(KST)에 자동 갱신함.
   * certbot renew는 만료 30일 이내 인증서만 실제 갱신하므로 매일 실행해도 안전함.
   * 갱신한 인증서는 renewAll()에서 ssl/로 복사한 뒤 Nginx를 다시 불러옴.
   */
  @Cron('10 4 * * *', { name: 'ssl-auto-renew', timeZone: 'Asia/Seoul' })
  async handleScheduledRenewal(): Promise<void> {
    this.logger.log('[SSL 자동 갱신] 스케줄 실행 시작');
    await this.runRenewal('schedule');
  }

  /**
   * 갱신 실행 결과를 영속화하는 수동·스케줄 공용 흐름임.
   */
  async runRenewal(
    trigger: 'schedule' | 'manual',
  ): Promise<{ success: boolean; output: string }> {
    const before = await this.listCerts();
    const result = await this.renewAll();
    const after = await this.listCerts();

    // certbot 출력 우선, 만료일 증가 보조 확인 순서로 갱신 도메인 추출함.
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

  /** 마지막 자동·수동 갱신 실행 결과 조회함. */
  getRenewalStatus(): RenewalStatus {
    try {
      if (fs.existsSync(RENEWAL_STATUS_FILE)) {
        return JSON.parse(fs.readFileSync(RENEWAL_STATUS_FILE, 'utf8'));
      }
    } catch {
      // 상태 파일 파싱 실패 시 기본 상태 반환함.
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
    // certbot 성공 출력의 live 경로에서 갱신 도메인 이름 추출함.
    const fromOutput = new Set<string>();
    const re = /live\/([^/\s]+)\/fullchain\.pem.*\(success\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(output)) !== null) fromOutput.add(m[1]);

    // 출력에 없는 경우도 만료일 증가 여부로 보조 확인함.
    const beforeMap = new Map(before.map((c) => [c.domain, c.daysLeft ?? -1]));
    for (const c of after) {
      const prev = beforeMap.get(c.domain) ?? -1;
      if (typeof c.daysLeft === 'number' && c.daysLeft > prev + 1) {
        fromOutput.add(c.domain);
      }
    }
    return [...fromOutput];
  }

  /** ssl 디렉터리의 도메인별 SSL 인증서 목록 조회함. */
  async listCerts(): Promise<CertInfo[]> {
    const certs: CertInfo[] = [];

    if (!fs.existsSync(SSL_DIR)) return certs;

    // ssl/에는 certbot·letsencrypt 메타 디렉터리도 섞일 수 있어 제외함.
    // 관리 도메인 폴더는 항상 점을 하나 이상 포함한다는 규칙 사용함.
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
   * Docker certbot의 webroot 모드로 새 SSL 인증서 발급함.
   * Nginx와 공유하는 certbot-webroot 볼륨으로 ACME 검증 파일 제공함.
   */
  async issueCert(
    domain: string,
    email: string,
  ): Promise<{ success: boolean; output: string }> {
    this.assertIssueInput(domain, email);
    this.logger.log(`Issuing SSL cert for ${domain}`);

    const webrootVolume = 'kscold-control_certbot-webroot';

    const args = [
      'run',
      '--rm',
      '--name',
      `certbot-${domain.replace(/\./g, '-')}`,
      '-v',
      `${webrootVolume}:/var/www/certbot`,
      '-v',
      `${LETSENCRYPT_DIR}:${LETSENCRYPT_DIR}`,
      '-v',
      `${LETSENCRYPT_LIB_DIR}:${LETSENCRYPT_LIB_DIR}`,
      'certbot/certbot',
      'certonly',
      '--webroot',
      '-w',
      '/var/www/certbot',
      '-d',
      domain,
      '--email',
      email,
      '--agree-tos',
      '--non-interactive',
      '--cert-name',
      domain,
    ];

    try {
      const { stdout, stderr } = await execFileAsync('docker', args, {
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

  /** 등록된 모든 인증서 갱신함. */
  async renewAll(): Promise<{ success: boolean; output: string }> {
    const webrootVolume = 'kscold-control_certbot-webroot';

    const args = [
      'run',
      '--rm',
      '--name',
      'certbot-renew',
      '-v',
      `${webrootVolume}:/var/www/certbot`,
      '-v',
      `${LETSENCRYPT_DIR}:${LETSENCRYPT_DIR}`,
      '-v',
      `${LETSENCRYPT_LIB_DIR}:${LETSENCRYPT_LIB_DIR}`,
      'certbot/certbot',
      'renew',
      '--webroot',
      '-w',
      '/var/www/certbot',
      '--non-interactive',
    ];

    try {
      const { stdout, stderr } = await execFileAsync('docker', args, {
        timeout: 300000,
      });
      const output = stdout + stderr;

      const certs = await this.listCerts();
      for (const cert of certs) {
        if (cert.exists) {
          try {
            await this.copyCertFromCertbot(cert.domain);
          } catch {
            // 일부 인증서 복사 실패가 전체 갱신 결과를 막지 않게 계속 진행함.
          }
        }
      }

      await this.runtimeRepo.reload();
      return { success: true, output };
    } catch (error: any) {
      return { success: false, output: error.message };
    }
  }

  /** Nginx 프록시가 아직 없는 도메인은 standalone 모드로 인증서 발급함. */
  async issueCertStandalone(
    domain: string,
    email: string,
  ): Promise<{ success: boolean; output: string }> {
    this.assertIssueInput(domain, email);
    this.logger.log(`Issuing SSL cert (standalone) for ${domain}`);

    const domainDir = path.join(SSL_DIR, domain);
    if (!fs.existsSync(domainDir)) {
      fs.mkdirSync(domainDir, { recursive: true });
    }

    try {
      await this.runtimeRepo.stop();
    } catch {
      // Nginx가 이미 중지 상태일 수 있으므로 중지 실패는 무시함.
    }

    const args = [
      'run',
      '--rm',
      '--name',
      `certbot-standalone-${domain.replace(/\./g, '-')}`,
      '--network',
      'host',
      '-v',
      `${domainDir}:/etc/ssl-output`,
      'certbot/certbot',
      'certonly',
      '--standalone',
      '-d',
      domain,
      '--email',
      email,
      '--agree-tos',
      '--non-interactive',
      '--fullchain-path',
      '/etc/ssl-output/fullchain.pem',
      '--key-path',
      '/etc/ssl-output/privkey.pem',
      '--cert-path',
      '/etc/ssl-output/cert.pem',
    ];

    try {
      const { stdout, stderr } = await execFileAsync('docker', args, {
        timeout: 120000,
      });
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

  /** certbot이 발급한 인증서를 서비스 ssl 디렉터리 구조로 복사함. */
  private async copyCertFromCertbot(domain: string): Promise<void> {
    const domainDir = path.join(SSL_DIR, domain);
    if (!fs.existsSync(domainDir)) {
      fs.mkdirSync(domainDir, { recursive: true });
    }

    // Docker certbot은 root 권한으로 /etc/letsencrypt를 읽을 수 있음.
    // macOS 파일 권한으로 Node 프로세스 접근이 막힐 수 있어 표준 출력으로 전달받음.
    // ssl 파일 소유자인 Node 프로세스가 최종 파일 쓰기를 수행하게 함.
    const liveDir = path.join(LETSENCRYPT_DIR, 'live', domain);
    const dockerHost = process.env.DOCKER_HOST || 'unix:///var/run/docker.sock';

    for (const file of ['fullchain.pem', 'privkey.pem']) {
      const src = path.join(liveDir, file);
      const dest = path.join(domainDir, file);
      const { stdout } = await execFileAsync(
        'docker',
        [
          'run',
          '--rm',
          '-v',
          `${LETSENCRYPT_DIR}:${LETSENCRYPT_DIR}`,
          '--entrypoint',
          'cat',
          'certbot/certbot',
          src,
        ],
        { env: { ...process.env, DOCKER_HOST: dockerHost } },
      );
      if (!stdout) throw new Error(`빈 인증서 출력: ${domain}/${file}`);
      fs.writeFileSync(dest, stdout, { mode: 0o644 });
    }
  }

  /** openssl로 인증서 발급자와 유효 기간 조회함. */
  private async getCertInfo(
    certPath: string,
  ): Promise<Omit<CertInfo, 'domain' | 'exists'>> {
    try {
      const { stdout } = await execFileAsync('openssl', [
        'x509',
        '-in',
        certPath,
        '-noout',
        '-issuer',
        '-dates',
      ]);

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

  private assertIssueInput(domain: string, email: string): void {
    if (
      !/^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/.test(
        domain,
      )
    ) {
      throw new BadRequestException(
        '인증서 발급 도메인 형식이 올바르지 않습니다.',
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException(
        '인증서 발급 이메일 형식이 올바르지 않습니다.',
      );
    }
  }
}
