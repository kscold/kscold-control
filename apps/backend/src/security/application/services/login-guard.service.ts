import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { isIP } from 'node:net';
import { AuditLogService } from '../../../audit/application/services/audit-log.service';
import { configuredProxyTrust } from '../../../common/utils/client-ip.util';
import {
  LOGIN_BLOCK_POLICY,
  decideLoginBlock,
  loginHistorySince,
  normalizeLoginAccount,
  type LoginAttemptReason,
  type LoginAttemptResult,
  type LoginOrigin,
  type LoginSubject,
} from '../../domain/login-guard/login-block.policy';
import {
  IP_BAN_REPOSITORY,
  type IIpBanRepository,
} from '../../domain/repositories/ip-ban.repository';
import {
  LOGIN_ATTEMPT_REPOSITORY,
  type ILoginAttemptRepository,
} from '../../domain/repositories/login-attempt.repository';
import { classifySshIp } from '../../domain/ssh-audit/ssh-audit.model';
import { CreateIpBanUseCase } from '../use-cases/create-ip-ban.use-case';
import { IpAllowlistService } from './ip-allowlist.service';
import { SshAccessService } from './ssh-access.service';

export const LOGIN_THROTTLED_MESSAGE =
  '로그인 시도가 너무 많습니다. 잠시 뒤 다시 시도해 주세요.';

const RESULT_LABEL: Record<LoginAttemptResult, string> = {
  success: '성공',
  failure: '실패',
  refused: '거절',
};

const REASON_LABEL: Record<LoginAttemptReason, string> = {
  'wrong-password': '비밀번호 불일치',
  'unknown-account': '없는 계정',
  'ip-banned': '차단된 IP',
  'account-locked': '계정 잠시 잠김',
};

/**
 * 반복된 로그인 실패를 막는다.
 * 비밀번호를 보기 전에 막힌 IP·계정을 돌려보내고, 실패가 쌓이면 nginx 차단과 호스트 방화벽 차단으로 올린다.
 */
@Injectable()
export class LoginGuardService {
  private readonly logger = new Logger(LoginGuardService.name);
  // 같은 IP 의 실패가 동시에 몰려도 차단과 nginx 다시 읽기를 한 번만 하도록 IP 별로 차례를 세운다.
  private readonly escalations = new Map<string, Promise<void>>();

  constructor(
    @Inject(LOGIN_ATTEMPT_REPOSITORY)
    private readonly attempts: ILoginAttemptRepository,
    @Inject(IP_BAN_REPOSITORY)
    private readonly ipBans: IIpBanRepository,
    private readonly createIpBan: CreateIpBanUseCase,
    private readonly allowlist: IpAllowlistService,
    private readonly sshAccess: SshAccessService,
    private readonly audit: AuditLogService,
  ) {}

  /** 비밀번호를 확인하기 전에 부른다. 막힌 시도면 기록하고 429 를 던진다. */
  async admit(ip: string | null, email: string): Promise<LoginSubject> {
    const subject: LoginSubject = {
      ip,
      account: normalizeLoginAccount(email),
      origin: await this.originOf(ip),
    };
    if (subject.origin === 'vouched') return subject;

    const now = new Date();
    const [ipBanned, history] = await Promise.all([
      subject.origin === 'external' && subject.ip
        ? this.isIpBanned(subject.ip, now)
        : false,
      this.history(subject, now),
    ]);
    const reason: LoginAttemptReason | null = ipBanned
      ? 'ip-banned'
      : decideLoginBlock(subject, history, now).accountLockedUntil
        ? 'account-locked'
        : null;
    if (!reason) return subject;

    await this.record(subject, 'refused', reason, now);
    await this.escalate(subject);
    throw new HttpException(
      LOGIN_THROTTLED_MESSAGE,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  async succeeded(
    subject: LoginSubject,
    user: { id: string; email: string },
  ): Promise<void> {
    await this.record(subject, 'success', null, new Date(), user);
  }

  async failed(
    subject: LoginSubject,
    reason: 'wrong-password' | 'unknown-account',
  ): Promise<void> {
    await this.record(subject, 'failure', reason, new Date());
    await this.escalate(subject);
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'login-attempts-prune' })
  async prune(): Promise<void> {
    const cutoff = new Date(Date.now() - LOGIN_BLOCK_POLICY.retentionMs);
    try {
      const removed = await this.attempts.deleteBefore(cutoff);
      if (removed > 0) this.logger.log(`오래된 로그인 기록 ${removed}건 정리`);
    } catch (error) {
      this.logger.error(`로그인 기록 정리 실패: ${(error as Error).message}`);
    }
  }

  /**
   * 운영자가 적어 둔 주소만 믿는다. 프록시 자신의 주소는 헤더가 빠졌을 때 모든 접속이 모이는 자리라
   * 허용 목록에 있어도 믿지 않고 계정 규칙을 건다.
   */
  private async originOf(ip: string | null): Promise<LoginOrigin> {
    if (!ip || this.isProxyAddress(ip)) return 'internal';
    if (
      this.allowlist.isListed(ip) ||
      (await this.sshAccess.knownIps()).includes(ip)
    ) {
      return 'vouched';
    }
    if (
      classifySshIp(ip) !== 'external' ||
      this.allowlist.isProtected(ip, null).protected
    ) {
      return 'internal';
    }
    return 'external';
  }

  private isProxyAddress(ip: string): boolean {
    const family = isIP(ip);
    return (
      family !== 0 &&
      configuredProxyTrust().proxies.check(ip, family === 4 ? 'ipv4' : 'ipv6')
    );
  }

  private async isIpBanned(ip: string, now: Date): Promise<boolean> {
    const ban = await this.ipBans.findByIp(ip);
    return !!ban?.active && (!ban.expiresAt || ban.expiresAt > now);
  }

  private history(subject: LoginSubject, now: Date) {
    const since = loginHistorySince(now);
    return this.attempts.recent({
      ip: subject.origin === 'external' ? subject.ip : null,
      ipSince: since.ip,
      account: subject.account,
      accountSince: since.account,
    });
  }

  private escalate(subject: LoginSubject): Promise<void> {
    const ip = subject.ip;
    if (subject.origin !== 'external' || !ip) return Promise.resolve();
    const previous = this.escalations.get(ip) ?? Promise.resolve();
    const next = previous.then(() => this.applyIpRules(subject, ip));
    this.escalations.set(ip, next);
    void next.finally(() => {
      if (this.escalations.get(ip) === next) this.escalations.delete(ip);
    });
    return next;
  }

  private async applyIpRules(subject: LoginSubject, ip: string): Promise<void> {
    try {
      const now = new Date();
      const decision = decideLoginBlock(
        subject,
        await this.history(subject, now),
        now,
      );
      if (decision.ipBanUntil && !(await this.isIpBanned(ip, now))) {
        const ban = await this.createIpBan.execute({
          ip,
          reason: `Control 로그인 ${LOGIN_BLOCK_POLICY.ipBan.attempts}회 실패`,
          ttlMinutes: Math.ceil(
            (decision.ipBanUntil.getTime() - now.getTime()) / 60_000,
          ),
          source: 'auto-login',
          createdBy: null,
          requesterIp: null,
        });
        this.auditEvent(
          'login.ip-ban',
          `로그인 실패가 반복된 IP ${ip} 를 nginx 에서 막았습니다.`,
          ip,
          { expiresAt: ban.expiresAt },
        );
      }
      if (decision.firewall) {
        const { items } = await this.sshAccess.firewallBlocks();
        if (!items.some((block) => block.ip === ip)) {
          await this.sshAccess.block(
            ip,
            `Control 로그인 실패 ${LOGIN_BLOCK_POLICY.firewall.attempts}회`,
          );
          this.auditEvent(
            'login.firewall-block',
            `하루 로그인 실패가 ${LOGIN_BLOCK_POLICY.firewall.attempts}회에 이른 IP ${ip} 를 방화벽 차단 목록에 올렸습니다.`,
            ip,
            {},
          );
        }
      }
    } catch (error) {
      // 차단에 실패해도 로그인 응답(401·429)은 그대로 돌려준다.
      this.logger.error(
        `로그인 차단 적용 실패 (${ip}): ${(error as Error).message}`,
      );
    }
  }

  private async record(
    subject: LoginSubject,
    result: LoginAttemptResult,
    reason: LoginAttemptReason | null,
    at: Date,
    user?: { id: string; email: string },
  ): Promise<void> {
    await this.attempts.append({ ...subject, result, reason, at });
    const detail = [
      `IP ${subject.ip ?? '알 수 없음'}`,
      reason ? REASON_LABEL[reason] : null,
    ]
      .filter(Boolean)
      .join(', ');
    void this.audit
      .record({
        domain: 'security',
        action: `login.${result}`,
        summary: `${subject.account} 로그인 ${RESULT_LABEL[result]} (${detail})`,
        actorId: user?.id ?? null,
        actorEmail: user?.email ?? null,
        targetType: 'account',
        targetId: subject.account,
        metadata: { ip: subject.ip, origin: subject.origin, result, reason },
      })
      .catch((error: Error) =>
        this.logger.error(`로그인 감사 기록 실패: ${error.message}`),
      );
  }

  private auditEvent(
    action: string,
    summary: string,
    ip: string,
    metadata: Record<string, unknown>,
  ): void {
    void this.audit
      .record({
        domain: 'security',
        action,
        summary,
        targetType: 'ip',
        targetId: ip,
        metadata,
      })
      .catch((error: Error) =>
        this.logger.error(`로그인 감사 기록 실패: ${error.message}`),
      );
  }
}
