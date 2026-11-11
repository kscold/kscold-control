import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { AuditLogService } from '../../../audit/application/services/audit-log.service';
import type { CreateAuditEventInput } from '../../../audit/domain/types/audit-event.type';
import { parseIpRange, rangeContains } from '../../domain/ip-range';
import {
  IP_GEO_READER,
  externalGeo,
  type IIpGeoReader,
} from '../../domain/repositories/ip-geo.reader';
import {
  DEFAULT_COUNTRY_GUARD_SETTINGS,
  countryBlockReason,
  parseCountries,
  parseCountryBlockReason,
  planCountryBlocks,
  type CountryBlockAction,
  type CountryGuardSettings,
  type ExistingBlock,
} from '../../domain/ssh-audit/country-guard.policy';
import type { SshAuditEvent } from '../../domain/ssh-audit/ssh-audit.model';
import { IpAllowlistService } from './ip-allowlist.service';
import {
  SshAccessService,
  sshAuditDir,
  type SshAuditCursor,
  type SshBlock,
  type SshBlockTransaction,
} from './ssh-access.service';

const SETTINGS_FILE = 'ssh-country-guard.json';
/** 처음 켜질 때와 설정을 바꾼 뒤 다시 훑는 기간 */
const RESCAN_DAYS = 7;

export interface SshCountryGuardStatus {
  enabled: boolean;
  /** off: 꺼 둠, no-geo: IP 위치 파일이 준비되지 않아 쉼, on: 동작 중 */
  state: 'off' | 'no-geo' | 'on';
  allowedCountries: string[];
  /** 설정 파일을 읽지 못해 꺼 둔 까닭. 화면에서 바꾸면 파일을 새로 쓴다 */
  error: string | null;
  /** 이 규칙이 올린 차단 수 (나라별) */
  blockedByCountry: Array<{
    country: string;
    countryName: string | null;
    count: number;
  }>;
}

/**
 * 허용 국가 밖에서 오는 SSH 접속을 실패 횟수를 기다리지 않고 바로 막는다.
 * 기록 파일에 새로 붙은 줄만 30초마다 읽고, 처음 돌 때와 설정을 바꾼 뒤에는 최근 7일을 다시 본다.
 * 위치를 모르는 IP 는 나라로 막지 않는다. 빈 칸 하나로 운영자를 잠그지 않도록 실패 횟수 규칙(차단기)에 맡긴다.
 */
@Injectable()
export class SshCountryGuardService {
  private readonly logger = new Logger(SshCountryGuardService.name);
  private cursor: SshAuditCursor | null = null;
  // 도는 중에 설정이 바뀌면 그 차례가 읽은 위치를 버리고 다음 차례에 7일을 다시 본다.
  private generation = 0;
  private running = false;
  private writing: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly ssh: SshAccessService,
    private readonly allowlist: IpAllowlistService,
    @Inject(IP_GEO_READER) private readonly geo: IIpGeoReader,
    private readonly audit: AuditLogService,
  ) {}

  async settings(): Promise<CountryGuardSettings> {
    return (await this.load()).settings;
  }

  /** 두 요청이 같은 설정을 읽고 서로 덮어쓰지 않도록 한 번에 하나씩 쓴다. */
  update(patch: Partial<CountryGuardSettings>): Promise<CountryGuardSettings> {
    const result = this.writing.then(() => this.write(patch));
    this.writing = result.catch(() => undefined);
    return result;
  }

  async status(blocks: readonly SshBlock[]): Promise<SshCountryGuardStatus> {
    const { settings, error } = await this.load();
    const counts = new Map<
      string,
      { countryName: string | null; count: number }
    >();
    for (const block of blocks) {
      const parsed = parseCountryBlockReason(block.reason);
      if (!parsed) continue;
      const row = counts.get(parsed.country) ?? {
        countryName:
          block.geo?.country === parsed.country ? block.geo.countryName : null,
        count: 0,
      };
      row.count += 1;
      counts.set(parsed.country, row);
    }
    return {
      ...settings,
      error,
      state: !settings.enabled
        ? 'off'
        : this.geo.status().state === 'ready'
          ? 'on'
          : 'no-geo',
      blockedByCountry: [...counts.entries()]
        .map(([country, row]) => ({ country, ...row }))
        .sort(
          (a, b) => b.count - a.count || a.country.localeCompare(b.country),
        ),
    };
  }

  /** 이 규칙이 그 나라에 올린 차단을 모두 푼다. 같은 IP 의 자동 차단도 함께 풀린다. */
  async unblockCountry(
    country: string,
  ): Promise<{ country: string; released: string[] }> {
    const code = country.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) {
      throw new BadRequestException('두 글자 국가 코드가 아닙니다');
    }
    const { items } = await this.ssh.firewallBlocks();
    const released: string[] = [];
    for (const block of items) {
      if (
        block.source === 'manual' &&
        parseCountryBlockReason(block.reason)?.country === code
      ) {
        await this.ssh.unblock(block.ip);
        released.push(block.ip);
      }
    }
    return { country: code, released };
  }

  @Interval('ssh-country-guard', 30_000)
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const settings = await this.settings();
      const active = settings.enabled && this.geo.status().state === 'ready';
      const generation = this.generation;
      const read = active ? await this.readNew() : null;
      const audits = await this.ssh.transaction(async (tx) => [
        ...(await this.widenAutoBlocked(tx)),
        ...(read && read.events.length > 0
          ? await this.blockOutsiders(tx, read.events, settings)
          : []),
      ]);
      for (const input of audits) this.record(input);
      if (read && generation === this.generation) this.cursor = read.cursor;
    } catch (error) {
      this.logger.error(`허용 국가 밖 SSH 차단 실패: ${String(error)}`);
    } finally {
      this.running = false;
    }
  }

  private async readNew(): Promise<{
    events: SshAuditEvent[];
    cursor: SshAuditCursor;
  }> {
    if (this.cursor) return this.ssh.eventsAfter(this.cursor);
    // 끝을 먼저 잡고 7일을 읽는다. 사이에 붙은 줄은 두 번 보지만 이미 막은 IP 는 다시 고르지 않는다.
    const cursor = await this.ssh.auditCursor();
    return { events: await this.ssh.recentEvents(RESCAN_DAYS), cursor };
  }

  /**
   * 범위 파일은 IP 마다 한 줄이라, 이 규칙이 적은 SSH 만 범위가 같은 IP 의 자동 차단(공격 규칙)까지 좁힌다.
   * 차단기가 공격으로 막은 IP 는 모든 접속을 막아야 하므로 넓힌다.
   */
  private async widenAutoBlocked(
    tx: SshBlockTransaction,
  ): Promise<CreateAuditEventInput[]> {
    const blocks = await tx.blocks();
    const auto = new Set(
      blocks.filter((b) => b.source === 'auto').map((b) => b.ip),
    );
    const audits: CreateAuditEventInput[] = [];
    for (const block of blocks) {
      if (!auto.has(block.ip) || block.scope !== 'ssh' || !isOwnContact(block))
        continue;
      await tx.setScope(block.ip, 'all');
      audits.push({
        domain: 'security',
        action: 'ssh.country-block.widen',
        summary: `허용 국가 밖이라 SSH 만 막던 IP ${block.ip} 를 차단기가 공격으로 막아 SSH·사이트 모두로 넓혔습니다.`,
        targetType: 'ip',
        targetId: block.ip,
        metadata: { country: parseCountryBlockReason(block.reason)?.country },
      });
    }
    return audits;
  }

  private async blockOutsiders(
    tx: SshBlockTransaction,
    events: readonly SshAuditEvent[],
    settings: CountryGuardSettings,
  ): Promise<CreateAuditEventInput[]> {
    const [known, blocks] = await Promise.all([tx.knownIps(), tx.blocks()]);
    const knownSet = new Set(known);
    const { actions, unknownCountryIps } = planCountryBlocks(events, {
      allowed: new Set(settings.allowedCountries),
      countryOf: (ip) => externalGeo(this.geo, ip)?.country ?? null,
      isExempt: (ip) =>
        knownSet.has(ip) || this.allowlist.isProtected(ip, null).protected,
      existing: (ip) => existingBlock(blocks, ip),
    });
    if (unknownCountryIps > 0) {
      this.logger.log(
        `위치를 모르는 외부 IP ${unknownCountryIps}개는 나라로 막지 않았습니다`,
      );
    }
    const audits: CreateAuditEventInput[] = [];
    for (const action of actions) {
      if (await this.act(tx, action)) audits.push(auditOf(action));
    }
    return audits;
  }

  private async act(
    tx: SshBlockTransaction,
    action: CountryBlockAction,
  ): Promise<boolean> {
    const reason = countryBlockReason(
      action.kind,
      action.country,
      action.users,
    );
    try {
      if (action.action === 'widen') {
        await tx.widen(action.ip, reason);
      } else {
        await tx.block(
          action.ip,
          reason,
          action.kind === 'attack' ? 'all' : 'ssh',
        );
      }
      return true;
    } catch (error) {
      this.logger.warn(`${action.ip} 를 막지 못했습니다: ${String(error)}`);
      return false;
    }
  }

  private record(input: CreateAuditEventInput) {
    void this.audit
      .record(input)
      .catch((error: Error) =>
        this.logger.error(`국가 차단 감사 기록 실패: ${error.message}`),
      );
  }

  /** 읽지 못하거나 형식이 틀린 설정으로 막기 시작하면 운영자가 잠길 수 있어 꺼진 것으로 본다. */
  private async load(): Promise<{
    settings: CountryGuardSettings;
    error: string | null;
  }> {
    const off = (why: string) => {
      const error = `${SETTINGS_FILE} ${why} 국가 차단을 꺼 두었습니다. 켜거나 허용 국가를 바꾸면 파일을 새로 씁니다.`;
      this.logger.warn(error);
      return {
        settings: { ...DEFAULT_COUNTRY_GUARD_SETTINGS, enabled: false },
        error,
      };
    };
    let raw: string;
    try {
      raw = await fs.readFile(this.settingsPath(), 'utf8');
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return { settings: { ...DEFAULT_COUNTRY_GUARD_SETTINGS }, error: null };
      }
      return off(`을 읽지 못해(${code ?? String(error)})`);
    }
    const data = parseJsonObject(raw);
    const countries = Array.isArray(data?.allowedCountries)
      ? parseCountries(data.allowedCountries)
      : null;
    if (
      typeof data?.enabled !== 'boolean' ||
      !countries ||
      countries.unknown.length > 0 ||
      countries.codes.length === 0
    ) {
      return off('형식이 맞지 않아');
    }
    return {
      settings: { enabled: data.enabled, allowedCountries: countries.codes },
      error: null,
    };
  }

  private async write(
    patch: Partial<CountryGuardSettings>,
  ): Promise<CountryGuardSettings> {
    const { settings: current } = await this.load();
    let allowedCountries = current.allowedCountries;
    if (patch.allowedCountries) {
      const { codes, unknown } = parseCountries(patch.allowedCountries);
      if (unknown.length > 0) {
        throw new BadRequestException(
          `ISO 3166-1 국가 코드가 아닙니다: ${unknown.join(', ')}`,
        );
      }
      allowedCountries = codes;
    }
    if (allowedCountries.length === 0) {
      // 허용 국가가 비면 모든 나라를 막아 운영자도 잠긴다.
      throw new BadRequestException('허용 국가를 한 나라 이상 적어 주세요');
    }
    const next: CountryGuardSettings = {
      enabled: patch.enabled ?? current.enabled,
      allowedCountries,
    };
    const path = this.settingsPath();
    const tmp = `${path}.${process.pid}.${randomUUID()}.tmp`;
    await fs.writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, {
      mode: 0o644,
    });
    await fs.rename(tmp, path);
    this.generation += 1;
    this.cursor = null;
    return next;
  }

  private settingsPath() {
    return join(sshAuditDir(), SETTINGS_FILE);
  }
}

function auditOf(action: CountryBlockAction): CreateAuditEventInput {
  const scope = action.kind === 'attack' ? 'SSH·사이트 모두' : 'SSH 만';
  const users = action.users.join(', ') || '알 수 없음';
  const summary = action.succeeded
    ? `허용 국가 밖(${action.country})의 IP ${action.ip} 에서 SSH 로그인이 성공했습니다 (계정 ${users}). 침입일 수 있습니다. 방화벽에서 ${scope} 막았고 열린 세션은 끊지 않았으니 SSH 탭에서 확인해 끊으세요.`
    : action.action === 'widen'
      ? `허용 국가 밖(${action.country})의 IP ${action.ip} 가 SSH 공격을 해 SSH 만 막던 차단을 SSH·사이트 모두로 넓혔습니다 (계정 ${users}).`
      : `허용 국가 밖(${action.country})의 IP ${action.ip} 를 방화벽에서 ${scope} 막았습니다 (계정 ${users}).`;
  return {
    domain: 'security',
    action: action.succeeded
      ? 'ssh.country-intrusion'
      : action.action === 'widen'
        ? 'ssh.country-block.widen'
        : 'ssh.country-block',
    summary,
    targetType: 'ip',
    targetId: action.ip,
    metadata: {
      country: action.country,
      kind: action.kind,
      users: action.users,
      succeeded: action.succeeded,
    },
  };
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function isOwnContact(block: SshBlock): boolean {
  return (
    block.source === 'manual' &&
    parseCountryBlockReason(block.reason)?.kind === 'contact'
  );
}

/** 범위는 IP 마다 하나라, 같은 IP 의 항목이 여럿이면(손·자동) 모두 같은 범위를 보인다. */
function existingBlock(blocks: readonly SshBlock[], ip: string): ExistingBlock {
  const exact = blocks.filter((b) => b.ip === ip);
  if (exact.length > 0) {
    return exact[0].scope === 'ssh' && exact.some(isOwnContact)
      ? 'widenable'
      : 'other';
  }
  const covered = blocks.some((b) => {
    if (!b.ip.includes('/')) return false;
    const range = parseIpRange(b.ip);
    return range !== null && rangeContains(range, ip);
  });
  return covered ? 'other' : 'none';
}
