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
import { parseIpRange, rangeContains } from '../../domain/ip-range';
import {
  LOGIN_BLOCK_POLICY,
  decideLoginBlock,
  loginHistorySince,
  loginIpGroup,
  normalizeLoginAccount,
  type LoginAttemptReason,
  type LoginAttemptRecord,
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

/** 로그인 요청을 보낸 주소. ipVerified 는 프록시 비밀값으로 그 주소를 확인했는지다. */
export interface LoginClient {
  ip: string | null;
  ipVerified: boolean;
}

export type PasswordCheck<U> =
  { user: U } | { failure: 'wrong-password' | 'unknown-account' };

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
  // 같은 IP 의 실패가 동시에 몰려도 차단을 한 번만 하도록 IP 대역별로 차례를 세운다.
  private readonly escalations = new Map<string, Promise<void>>();
  // 비밀번호를 확인하는 중인 시도. 아직 기록되지 않았으니 뒤에 온 시도는 이것을 실패로 가정해 센다.
  // Control 은 PM2 fork 하나로 돌아(ecosystem.config.js) 프로세스 안에서 세면 모든 요청이 보인다.
  private readonly inFlight = new Set<LoginAttemptRecord>();

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

  /**
   * 비밀번호 확인을 감싼다. 막힌 시도면 기록하고 429 를 던지고, 틀리면 기록하고 null 을 돌려준다.
   * 동시에 들어온 시도는 앞서 확인 중인 시도를 실패로 세므로, 한도보다 많이 비밀번호 확인까지 가지 못한다.
   */
  async check<U extends { id: string; email: string }>(
    client: LoginClient,
    email: string,
    verify: () => Promise<PasswordCheck<U>>,
  ): Promise<U | null> {
    const subject = await this.subjectOf(client, email);
    const pending: LoginAttemptRecord = {
      ...subject,
      result: 'failure',
      reason: null,
      at: new Date(),
    };
    const ahead = [...this.inFlight];
    this.inFlight.add(pending);
    let outcome: PasswordCheck<U>;
    try {
      await this.refuseIfBlocked(subject, ahead);
      outcome = await verify();
      if ('user' in outcome) {
        await this.record(subject, 'success', null, outcome.user);
      } else {
        await this.record(subject, 'failure', outcome.failure);
      }
    } finally {
      this.inFlight.delete(pending);
    }
    if ('user' in outcome) return outcome.user;
    await this.escalate(subject);
    return null;
  }

  @Cron(CronExpression.EVERY_HOUR, { name: 'login-attempts-prune' })
  async prune(): Promise<void> {
    const cutoff = new Date(Date.now() - LOGIN_BLOCK_POLICY.retentionMs);
    try {
      const attempts = await this.attempts.deleteBefore(cutoff);
      const bans = await this.ipBans.deleteExpiredBefore(cutoff);
      if (attempts + bans > 0) {
        this.logger.log(
          `오래된 로그인 기록 ${attempts}건, 만료된 IP 차단 ${bans}건 정리`,
        );
      }
    } catch (error) {
      this.logger.error(`로그인 기록 정리 실패: ${(error as Error).message}`);
    }
  }

  private async subjectOf(
    client: LoginClient,
    email: string,
  ): Promise<LoginSubject> {
    return {
      ip: client.ip,
      ipGroup: loginIpGroup(client.ip),
      account: normalizeLoginAccount(email),
      origin: await this.originOf(client),
    };
  }

  /**
   * 확인한 주소만 IP 규칙과 허용 목록 예외를 받는다. 프록시 자신의 주소는 헤더가 빠졌을 때 모든 접속이 모이는 자리라
   * 허용 목록에 있어도 믿지 않는다.
   */
  private async originOf({
    ip,
    ipVerified,
  }: LoginClient): Promise<LoginOrigin> {
    if (!ip) return 'unverified';
    const internal =
      this.isProxyAddress(ip) ||
      classifySshIp(ip) !== 'external' ||
      this.allowlist.isPrivate(ip);
    // 확인하지 못했어도 내부 주소면 계정 잠금을 내부망 몫으로 센다. 내부 출처는 IP 로 막지 않으니
    // 꾸민 내부 주소로는 내부망 몫의 잠금만 건드릴 수 있고, 비밀값이 없을 때도 바깥 실패가 내부망 로그인을 잠그지 못한다.
    if (!ipVerified) return internal ? 'internal' : 'unverified';
    if (this.isProxyAddress(ip)) return 'internal';
    if (
      this.allowlist.isListed(ip) ||
      (await this.sshAccess.knownIps()).includes(ip)
    ) {
      return 'vouched';
    }
    return internal ? 'internal' : 'external';
  }

  private isProxyAddress(ip: string): boolean {
    const family = isIP(ip);
    return (
      family !== 0 &&
      configuredProxyTrust().proxies.check(ip, family === 4 ? 'ipv4' : 'ipv6')
    );
  }

  private async refuseIfBlocked(
    subject: LoginSubject,
    ahead: readonly LoginAttemptRecord[],
  ): Promise<void> {
    const now = new Date();
    const [banned, history] = await Promise.all([
      subject.origin === 'external' && subject.ipGroup
        ? this.isIpBanned(subject.ipGroup, now)
        : false,
      this.history(subject, now),
    ]);
    const settled = decideLoginBlock(subject, history, now);
    // 확인 중인 시도까지 셈한 판정은 기록만으로 막히지 않을 때만 본다. 이미 잠긴 계정에 몰린 시도가
    // 서로를 IP 실패로 세면, 공격으로 잠긴 계정에 다시 시도한 운영자의 IP 가 막힐 수 있다.
    const withPending = decideLoginBlock(subject, [...history, ...ahead], now);
    const reason: LoginAttemptReason | null =
      banned || settled.ipBanUntil
        ? 'ip-banned'
        : settled.accountLockedUntil
          ? 'account-locked'
          : withPending.ipBanUntil
            ? 'ip-banned'
            : withPending.accountLockedUntil
              ? 'account-locked'
              : null;
    if (!reason) return;

    await this.record(subject, 'refused', reason);
    await this.escalate(subject);
    throw new HttpException(
      LOGIN_THROTTLED_MESSAGE,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private async isIpBanned(target: string, now: Date): Promise<boolean> {
    const ban = await this.ipBans.findByIp(target);
    return !!ban?.active && (!ban.expiresAt || ban.expiresAt > now);
  }

  private history(subject: LoginSubject, now: Date) {
    const since = loginHistorySince(now);
    return this.attempts.recent({
      ipGroup: subject.origin === 'external' ? subject.ipGroup : null,
      ipSince: since.ip,
      account: subject.account,
      accountSince: since.account,
    });
  }

  private escalate(subject: LoginSubject): Promise<void> {
    const target = subject.ipGroup;
    if (subject.origin !== 'external' || !target) return Promise.resolve();
    const previous = this.escalations.get(target) ?? Promise.resolve();
    const next = previous.then(() => this.applyIpRules(subject, target));
    this.escalations.set(target, next);
    void next.finally(() => {
      if (this.escalations.get(target) === next) {
        this.escalations.delete(target);
      }
    });
    return next;
  }

  private async applyIpRules(
    subject: LoginSubject,
    target: string,
  ): Promise<void> {
    try {
      const now = new Date();
      const decision = decideLoginBlock(
        subject,
        await this.history(subject, now),
        now,
      );
      if (!decision.ipBanUntil && !decision.firewall) return;
      const shielded = await this.shieldedBy(target);
      if (shielded) {
        this.logger.warn(
          `로그인 실패가 반복된 ${target} 를 nginx·방화벽에 올리지 않습니다(${shielded}). 로그인은 계속 429 로 돌려보냅니다.`,
        );
        return;
      }
      if (decision.ipBanUntil && !(await this.isIpBanned(target, now))) {
        const ban = await this.createIpBan.execute({
          ip: target,
          reason: `Control 로그인 ${LOGIN_BLOCK_POLICY.ipBan.attempts}회 실패`,
          ttlMinutes: Math.ceil(
            (decision.ipBanUntil.getTime() - now.getTime()) / 60_000,
          ),
          source: 'auto-login',
          createdBy: null,
          requesterIp: null,
          deferResync: true,
        });
        this.auditEvent(
          'login.ip-ban',
          `로그인 실패가 반복된 IP ${target} 를 nginx 에서 막았습니다.`,
          target,
          { expiresAt: ban.expiresAt },
        );
      }
      if (decision.firewall) {
        const { items } = await this.sshAccess.firewallBlocks();
        if (!items.some((block) => block.ip === target)) {
          await this.sshAccess.block(
            target,
            `Control 로그인 실패 ${LOGIN_BLOCK_POLICY.firewall.attempts}회`,
          );
          this.auditEvent(
            'login.firewall-block',
            `하루 로그인 실패가 ${LOGIN_BLOCK_POLICY.firewall.attempts}회에 이른 IP ${target} 를 방화벽 차단 목록에 올렸습니다.`,
            target,
            {},
          );
        }
      }
    } catch (error) {
      // 차단에 실패해도 로그인 응답(401·429)은 그대로 돌려준다.
      this.logger.error(
        `로그인 차단 적용 실패 (${target}): ${(error as Error).message}`,
      );
    }
  }

  /**
   * 운영자가 보호해 둔 주소를 덮는 대상이면 그 까닭.
   * 넓게 적은 허용 대역과, IPv6 /64 안에 든 SSH 내 IP 가 여기에 걸린다.
   */
  private async shieldedBy(target: string): Promise<string | null> {
    const guard = this.allowlist.isProtected(target, null);
    if (guard.protected) return guard.reason ?? '보호 대역';
    const range = parseIpRange(target);
    const known = (await this.sshAccess.knownIps()).find(
      (ip) => range !== null && rangeContains(range, ip),
    );
    return known ? `내 IP ${known} 를 품은 대역입니다.` : null;
  }

  private async record(
    subject: LoginSubject,
    result: LoginAttemptResult,
    reason: LoginAttemptReason | null,
    user?: { id: string; email: string },
  ): Promise<void> {
    await this.attempts.append({ ...subject, result, reason, at: new Date() });
    // 돌려보낸 시도는 login_attempts 에만 남긴다. 감사 기록까지 쓰면 두드리는 만큼 파일이 커진다.
    if (result === 'refused') return;
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
