import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { isIP } from 'node:net';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  classifySshIp,
  parseRemoteEndpoint,
  parseSshAuditLine,
  parseSshSessionCommand,
  summarizeSshAudit,
  type SshAuditEvent,
  type SshAuditSummary,
  type SshIpScope,
} from '../../domain/ssh-audit/ssh-audit.model';
import {
  parseIpRange,
  rangeContains,
  rangesOverlap,
  type IpFamily,
  type IpRange,
} from '../../domain/ip-range';
import { IpAllowlistService } from './ip-allowlist.service';

const execFileAsync = promisify(execFile);

/** 기록 파일 하나에서 끝부분만 읽는 크기 — 기록기는 20MB 에서 .1 로 넘김 */
const TAIL_BYTES = 8 * 1024 * 1024;
const MAX_EVENTS = 400;
/** 차단기 상태 파일이 이보다 오래되면 꺼진 것으로 봄 (차단기는 15초마다 씀) */
const GUARD_STALE_MS = 2 * 60 * 1000;
const PROCESS_TIMEOUT_MS = 5_000;
/** 손으로나 로그인 차단으로 방화벽에 올릴 수 있는 가장 넓은 대역. 로그인 차단은 IPv4 주소 하나, IPv6 /64 를 올린다. */
const MIN_BLOCK_PREFIX: Record<IpFamily, number> = { ipv4: 24, ipv6: 48 };
/** classifySshIp 가 내부로 보는 대역. 대역 차단이 이 주소를 덮는지 보려고 대역으로 둔다. */
const INTERNAL_RANGES = [
  '127.0.0.0/8',
  '::1/128',
  '10.0.0.0/8',
  '192.168.0.0/16',
  '100.64.0.0/10',
].map((cidr) => parseIpRange(cidr) as IpRange);

export interface SshSession {
  pid: number;
  user: string;
  tty: string | null;
  startedAt: string | null;
  ip: string | null;
  port: number | null;
  scope: SshIpScope;
  known: boolean;
}

/** 차단 범위 — all: 맥미니의 모든 접속(SSH·운영 사이트), ssh: SSH(22)만 */
export type SshBlockScope = 'all' | 'ssh';

export interface SshBlock {
  ip: string;
  source: 'auto' | 'manual';
  blockedAt: string | null;
  reason: string | null;
  scope: SshBlockScope;
}

/** 내 IP — 별칭(회사·집 등)을 같이 둠 */
export interface SshKnownIp {
  ip: string;
  label: string | null;
}

export interface SshGuardStatus {
  installed: boolean;
  running: boolean;
  updatedAt: string | null;
  pfEnabled: boolean | null;
  blockedCount: number | null;
  /** 모든 접속을 막는 IP 수 / SSH 만 막는 IP 수 (차단기 새 버전부터) */
  allCount: number | null;
  sshOnlyCount: number | null;
}

export interface SshAccessOverview {
  recorder: { logPath: string; exists: boolean; updatedAt: string | null };
  guard: SshGuardStatus;
  summary: SshAuditSummary;
  events: SshAuditEvent[];
  sessions: SshSession[];
  /** 인증 전 단계에 머문 접속 수 (sshd-session [net]) */
  pendingAuth: number;
  knownIps: SshKnownIp[];
  blocks: SshBlock[];
}

/**
 * SSH 접속 기록·열린 세션·차단 목록
 *
 * 맥미니의 root 데몬 둘이 쓰는 파일을 읽고, 사람이 바꾸는 목록만 씁니다.
 * - com.kscold.ssh-audit: ssh-audit.log 에 접속 기록
 * - com.kscold.ssh-guard: ssh-block-*.txt 를 읽어 pf 표에 올림 (Control 은 pf 를 직접 만지지 않음)
 *   ssh-block-scope.tsv 에 IP<TAB>ssh 로 적은 IP 는 SSH 만, 나머지는 모든 접속을 막음
 */
@Injectable()
export class SshAccessService {
  private readonly logger = new Logger(SshAccessService.name);
  private readonly dir =
    process.env.SSH_AUDIT_DIR || join(homedir(), 'server-watchdog');
  private mutation: Promise<void> = Promise.resolve();

  constructor(private readonly allowlist: IpAllowlistService) {}

  // 단일 Control 프로세스의 읽기-수정-쓰기가 서로 덮어쓰지 않도록 순서를 보장함.
  private change<T>(action: () => Promise<T>): Promise<T> {
    const result = this.mutation.then(action);
    this.mutation = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  addKnownIp(ip: string, label?: string | null) {
    return this.change(() => this.addKnownIpEntry(ip, label));
  }
  /** 내 IP 별칭 바꾸기 — 빈 값이면 별칭을 지움 */
  setKnownIpLabel(ip: string, label: string | null) {
    return this.change(() => this.setKnownIpLabelEntry(ip, label));
  }
  removeKnownIp(ip: string) {
    return this.change(() => this.removeKnownIpEntry(ip));
  }
  block(ip: string, reason: string | null, scope: SshBlockScope = 'all') {
    return this.change(() => this.blockEntry(ip, reason, scope));
  }
  unblock(ip: string) {
    return this.change(() => this.unblockEntry(ip));
  }
  /** 막는 범위 바꾸기 — 모든 접속(사이트 포함) 또는 SSH 만. 차단기가 15초 안에 반영 */
  setBlockScope(ip: string, scope: SshBlockScope) {
    return this.change(() => this.setBlockScopeEntry(ip, scope));
  }

  private file(name: string) {
    return join(this.dir, name);
  }

  /** 내 IP 목록의 주소만 */
  knownIps(): Promise<string[]> {
    return this.readKnownIps();
  }

  /** 방화벽 차단 목록만 — 웹 IP 차단 화면에서 같이 보여 주려고 기록·프로세스는 읽지 않음 */
  async firewallBlocks(): Promise<{
    guard: SshGuardStatus;
    items: SshBlock[];
  }> {
    const [guard, items] = await Promise.all([
      this.readGuardStatus(),
      this.readBlocks(),
    ]);
    return { guard, items };
  }

  async overview(days: number): Promise<SshAccessOverview> {
    const safeDays = Math.min(Math.max(Math.trunc(days) || 7, 1), 90);
    const since = formatLocal(new Date(Date.now() - safeDays * 86_400_000));
    const logPath = this.file('ssh-audit.log');

    const [events, logStat, knownIps, blocks, guard, procs] = await Promise.all(
      [
        this.readEvents(since),
        fs.stat(logPath).catch(() => null),
        this.readKnownEntries(),
        this.readBlocks(),
        this.readGuardStatus(),
        this.listSshProcesses(),
      ],
    );
    const known = new Set(knownIps.map((k) => k.ip));

    return {
      recorder: {
        logPath,
        exists: !!logStat,
        updatedAt: logStat ? logStat.mtime.toISOString() : null,
      },
      guard,
      summary: summarizeSshAudit(events, known, since),
      events: events.slice(-MAX_EVENTS).reverse(),
      sessions: procs.sessions.map((s) => ({
        ...s,
        known: !!s.ip && known.has(s.ip),
      })),
      pendingAuth: procs.pendingAuth,
      knownIps,
      blocks,
    };
  }

  /** 열린 SSH 세션 하나를 끊습니다 — 지금 목록에 있는 인증된 세션만 */
  async terminateSession(pid: number): Promise<SshSession> {
    const { sessions } = await this.listSshProcesses();
    const target = sessions.find((s) => s.pid === pid);
    if (!target) {
      throw new NotFoundException('열린 SSH 세션 목록에 없는 프로세스입니다');
    }
    try {
      process.kill(pid, 'SIGTERM');
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'EPERM') {
        throw new BadRequestException(
          'Control 이 끊을 권한이 없는 세션입니다 (다른 계정 소유)',
        );
      }
      if (code !== 'ESRCH') throw error;
    }
    return { ...target, known: false };
  }

  private async addKnownIpEntry(
    ip: string,
    label?: string | null,
  ): Promise<SshKnownIp[]> {
    const value = normalizeIp(ip);
    const list = await this.readKnownEntries();
    const existing = list.find((k) => k.ip === value);
    const clean = cleanLabel(label);
    if (!existing) {
      list.push({ ip: value, label: clean });
      await this.writeKnown(list);
    } else if (clean && clean !== existing.label) {
      existing.label = clean;
      await this.writeKnown(list);
    }
    // 내 IP 는 자동 차단에서도 빼 달라고 차단기에 알림
    await this.appendLine('ssh-block-release.txt', value);
    return list;
  }

  private async setKnownIpLabelEntry(
    ip: string,
    label: string | null,
  ): Promise<SshKnownIp[]> {
    const value = normalizeIp(ip);
    const list = await this.readKnownEntries();
    const target = list.find((k) => k.ip === value);
    if (!target) throw new NotFoundException('내 IP 목록에 없는 IP 입니다');
    target.label = cleanLabel(label);
    await this.writeKnown(list);
    return list;
  }

  private async removeKnownIpEntry(ip: string): Promise<SshKnownIp[]> {
    const value = normalizeIp(ip);
    const list = (await this.readKnownEntries()).filter((k) => k.ip !== value);
    await this.writeKnown(list);
    return list;
  }

  private async blockEntry(
    ip: string,
    reason: string | null,
    scope: SshBlockScope = 'all',
  ): Promise<SshBlock> {
    const value = normalizeBlockTarget(ip);
    await this.refuseUnsafeBlock(value);
    const manual = await this.readManual();
    const existing = manual.find((b) => b.ip === value);
    await this.writeScope(value, scope);
    if (existing) return { ...existing, scope };
    const entry: SshBlock = {
      ip: value,
      source: 'manual',
      scope,
      blockedAt: formatLocal(new Date()),
      reason:
        reason
          ?.replace(/[\t\r\n]+/g, ' ')
          .trim()
          .slice(0, 200) || null,
    };
    await this.appendLine(
      'ssh-block-manual.txt',
      [entry.ip, entry.blockedAt, entry.reason ?? ''].join('\t'),
    );
    return entry;
  }

  /**
   * 운영자가 스스로를 막는 대상은 쓰지 않는다. 너무 넓은 대역과, 내부·허용 목록 대역이나 내 IP 를 덮는 대역이다.
   * 해제는 이 검사를 거치지 않으므로 예전에 넓게 적은 항목도 풀 수 있다.
   */
  private async refuseUnsafeBlock(value: string): Promise<void> {
    const range = parseIpRange(value) as IpRange;
    if (range.prefix < MIN_BLOCK_PREFIX[range.family]) {
      throw new BadRequestException(
        `IPv4 /${MIN_BLOCK_PREFIX.ipv4}, IPv6 /${MIN_BLOCK_PREFIX.ipv6} 보다 넓은 대역은 막을 수 없습니다`,
      );
    }
    if (
      INTERNAL_RANGES.some((internal) => rangesOverlap(internal, range)) ||
      this.allowlist.isProtected(value, null).protected
    ) {
      throw new BadRequestException(
        '맥미니·내부망·Tailscale·허용 목록 주소는 막을 수 없습니다',
      );
    }
    const known = (await this.readKnownIps()).find((knownIp) =>
      rangeContains(range, knownIp),
    );
    if (known) {
      throw new BadRequestException(
        `내 IP 목록에 있는 주소(${known})입니다. 먼저 목록에서 빼 주세요`,
      );
    }
  }

  /** 차단 해제 — 손으로 막은 것은 목록에서 지우고, 자동 차단은 차단기에 해제를 요청 */
  private async unblockEntry(
    ip: string,
  ): Promise<{ ip: string; released: Array<SshBlock['source']> }> {
    const value = normalizeBlockTarget(ip);
    const released: Array<SshBlock['source']> = [];
    const manualLines = await this.readLines('ssh-block-manual.txt');
    const kept = manualLines.filter((l) => l.split('\t')[0]?.trim() !== value);
    if (kept.length !== manualLines.length) {
      await this.writeLines('ssh-block-manual.txt', kept);
      released.push('manual');
    }
    const auto = await this.readAuto();
    if (auto.some((b) => b.ip === value)) {
      await this.appendLine('ssh-block-release.txt', value);
      released.push('auto');
    }
    if (released.length === 0) {
      throw new NotFoundException('차단 목록에 없는 IP 입니다');
    }
    await this.writeScope(value, 'all');
    return { ip: value, released };
  }

  private async setBlockScopeEntry(
    ip: string,
    scope: SshBlockScope,
  ): Promise<SshBlock> {
    const value = normalizeBlockTarget(ip);
    const target = (await this.readBlocks()).find((b) => b.ip === value);
    if (!target) throw new NotFoundException('차단 목록에 없는 IP 입니다');
    await this.writeScope(value, scope);
    return { ...target, scope };
  }

  // ---- 읽기 ----

  private async readEvents(since: string): Promise<SshAuditEvent[]> {
    const current = await this.tail(this.file('ssh-audit.log'));
    const first = current.find((l) => l.trim());
    // 지금 파일이 기간 시작보다 늦게 시작하면 넘겨 둔 .1 도 읽음
    const needOld = !first || first.slice(0, 19) > since;
    const old = needOld ? await this.tail(this.file('ssh-audit.log.1')) : [];
    const events: SshAuditEvent[] = [];
    for (const line of [...old, ...current]) {
      const e = parseSshAuditLine(line);
      if (e && e.at >= since) events.push(e);
    }
    return events;
  }

  private async tail(path: string): Promise<string[]> {
    let handle: fs.FileHandle | null = null;
    try {
      handle = await fs.open(path, 'r');
      const { size } = await handle.stat();
      const start = Math.max(0, size - TAIL_BYTES);
      const buf = Buffer.alloc(size - start);
      await handle.read(buf, 0, buf.length, start);
      const lines = buf.toString('utf8').split('\n');
      // 중간부터 읽었으면 잘린 첫 줄은 버림
      if (start > 0) lines.shift();
      return lines;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`SSH 기록 읽기 실패 ${path}: ${String(error)}`);
      }
      return [];
    } finally {
      await handle?.close();
    }
  }

  private async readLines(name: string): Promise<string[]> {
    try {
      const raw = await fs.readFile(this.file(name), 'utf8');
      return raw
        .split('\n')
        .map((l) => l.replace(/\r$/, ''))
        .filter((l) => l.trim());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  private async readKnownIps(): Promise<string[]> {
    return (await this.readKnownEntries()).map((k) => k.ip);
  }

  /** ssh-known-ips.txt — 한 줄에 IP, 공백·탭 뒤는 별칭 */
  private async readKnownEntries(): Promise<SshKnownIp[]> {
    return (await this.readLines('ssh-known-ips.txt'))
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => {
        const m = /^(\S+)\s*(.*)$/.exec(l);
        return { ip: m?.[1] ?? l, label: m?.[2]?.trim() || null };
      });
  }

  /** SSH 만 막을 IP 목록 (나머지는 모든 접속을 막음) */
  private async readScopes(): Promise<Map<string, SshBlockScope>> {
    const map = new Map<string, SshBlockScope>();
    for (const l of await this.readLines('ssh-block-scope.tsv')) {
      const [ip, scope] = l.split('\t').map((v) => v?.trim());
      if (ip && scope === 'ssh') map.set(ip, 'ssh');
    }
    return map;
  }

  private async readManual(): Promise<SshBlock[]> {
    return (await this.readLines('ssh-block-manual.txt'))
      .filter((l) => !l.trim().startsWith('#'))
      .map((l) => {
        const [ip, at, reason] = l.split('\t');
        return {
          ip: ip.trim(),
          source: 'manual' as const,
          blockedAt: at?.trim() || null,
          reason: reason?.trim() || null,
          scope: 'all' as SshBlockScope,
        };
      });
  }

  private async readAuto(): Promise<SshBlock[]> {
    return (await this.readLines('ssh-block-auto.tsv')).map((l) => {
      const [ip, at, , reason] = l.split('\t');
      return {
        ip: ip.trim(),
        source: 'auto' as const,
        blockedAt: at?.trim() || null,
        reason: reason?.trim() || null,
        scope: 'all' as SshBlockScope,
      };
    });
  }

  private async readBlocks(): Promise<SshBlock[]> {
    const [auto, manual, pending, scopes] = await Promise.all([
      this.readAuto(),
      this.readManual(),
      this.readLines('ssh-block-release.txt'),
      this.readScopes(),
    ]);
    const releasing = new Set(pending.map((l) => l.trim()));
    return [...manual, ...auto.filter((b) => !releasing.has(b.ip))]
      .map((b) => ({ ...b, scope: scopes.get(b.ip) ?? 'all' }))
      .sort((a, b) => (b.blockedAt ?? '').localeCompare(a.blockedAt ?? ''));
  }

  private async readGuardStatus(): Promise<SshGuardStatus> {
    const installed = await fs
      .access('/Library/LaunchDaemons/com.kscold.ssh-guard.plist')
      .then(() => true)
      .catch(() => false);
    try {
      const path = this.file('ssh-guard-status.json');
      const [raw, stat] = await Promise.all([
        fs.readFile(path, 'utf8'),
        fs.stat(path),
      ]);
      const data = JSON.parse(raw) as {
        updatedAt?: string;
        pfEnabled?: boolean;
        blockedCount?: number;
        allCount?: number;
        sshOnlyCount?: number;
      };
      return {
        installed,
        running: Date.now() - stat.mtimeMs < GUARD_STALE_MS,
        updatedAt: stat.mtime.toISOString(),
        pfEnabled: typeof data.pfEnabled === 'boolean' ? data.pfEnabled : null,
        blockedCount:
          typeof data.blockedCount === 'number' ? data.blockedCount : null,
        allCount: typeof data.allCount === 'number' ? data.allCount : null,
        sshOnlyCount:
          typeof data.sshOnlyCount === 'number' ? data.sshOnlyCount : null,
      };
    } catch {
      return {
        installed,
        running: false,
        updatedAt: null,
        pfEnabled: null,
        blockedCount: null,
        allCount: null,
        sshOnlyCount: null,
      };
    }
  }

  /** ps 로 sshd 세션 프로세스를 찾고 lsof 로 원격 주소를 짝지음 */
  private async listSshProcesses(): Promise<{
    sessions: Omit<SshSession, 'known'>[];
    pendingAuth: number;
  }> {
    const env = { ...process.env, LC_ALL: 'C' };
    let psOut: string;
    try {
      psOut = (
        await execFileAsync(
          '/bin/ps',
          ['-axww', '-o', 'pid=,user=,lstart=,command='],
          { env, maxBuffer: 8 * 1024 * 1024, timeout: PROCESS_TIMEOUT_MS },
        )
      ).stdout;
    } catch (error) {
      this.logger.warn(`ps 실행 실패: ${String(error)}`);
      return { sessions: [], pendingAuth: 0 };
    }

    const sessions: Omit<SshSession, 'known'>[] = [];
    let pendingAuth = 0;
    for (const line of psOut.split('\n')) {
      // pid user 요일 월 일 시각 연도 command
      const m =
        /^\s*(\d+)\s+(\S+)\s+(\w{3}\s+\w{3}\s+\d+\s+[\d:]+\s+\d{4})\s+(.*)$/.exec(
          line,
        );
      if (!m) continue;
      const [, pid, owner, lstart, command] = m;
      if (!/^sshd(-session)?:/.test(command)) continue;
      if (/\[net\]\s*$/.test(command)) {
        pendingAuth += 1;
        continue;
      }
      // [priv] 는 root 감독 프로세스 — 실제 세션은 사용자 소유 자식
      if (owner === 'root' || owner === '_sshd') continue;
      const parsed = parseSshSessionCommand(command);
      if (!parsed) continue;
      const started = new Date(lstart.replace(/\s+/g, ' '));
      sessions.push({
        pid: Number(pid),
        user: parsed.user,
        tty: parsed.tty,
        startedAt: Number.isNaN(started.getTime())
          ? null
          : started.toISOString(),
        ip: null,
        port: null,
        scope: 'unknown',
      });
    }

    if (sessions.length > 0) {
      const endpoints = await this.lsofEndpoints(sessions.map((s) => s.pid));
      for (const s of sessions) {
        const ep = endpoints.get(s.pid);
        if (ep) {
          s.ip = ep.ip;
          s.port = ep.port;
          s.scope = classifySshIp(ep.ip);
        }
      }
    }
    sessions.sort((a, b) =>
      (b.startedAt ?? '').localeCompare(a.startedAt ?? ''),
    );
    return { sessions, pendingAuth };
  }

  private async lsofEndpoints(
    pids: number[],
  ): Promise<Map<number, { ip: string; port: number }>> {
    const map = new Map<number, { ip: string; port: number }>();
    let stdout: string;
    try {
      stdout = (
        await execFileAsync(
          '/usr/sbin/lsof',
          [
            '-nP',
            '-a',
            '-p',
            pids.join(','),
            '-iTCP',
            '-sTCP:ESTABLISHED',
            '-F',
            'pn',
          ],
          {
            env: { ...process.env, LC_ALL: 'C' },
            maxBuffer: 4 * 1024 * 1024,
            timeout: PROCESS_TIMEOUT_MS,
          },
        )
      ).stdout;
    } catch (error) {
      // 일부 pid 에 연결이 없으면 lsof 가 1 로 끝나도 찾은 것은 출력함
      stdout = (error as { stdout?: string }).stdout ?? '';
    }
    let pid = 0;
    for (const line of stdout.split('\n')) {
      if (line.startsWith('p')) pid = Number(line.slice(1));
      else if (line.startsWith('n') && pid && !map.has(pid)) {
        // 맥미니의 22번으로 들어온 연결만 (세션이 연 다른 연결 제외)
        if (!/:22->/.test(line)) continue;
        const ep = parseRemoteEndpoint(line.slice(1));
        if (ep) map.set(pid, ep);
      }
    }
    return map;
  }

  // ---- 쓰기 ----

  private async writeLines(name: string, lines: string[]) {
    const path = this.file(name);
    const tmp = `${path}.${process.pid}.tmp`;
    await fs.writeFile(tmp, lines.length ? `${lines.join('\n')}\n` : '', {
      mode: 0o644,
    });
    await fs.rename(tmp, path);
  }

  private async writeKnown(list: SshKnownIp[]) {
    await this.writeLines(
      'ssh-known-ips.txt',
      list.map((k) => (k.label ? `${k.ip}\t${k.label}` : k.ip)),
    );
  }

  private async writeScope(ip: string, scope: SshBlockScope) {
    const scopes = await this.readScopes();
    if (scope === 'ssh') scopes.set(ip, 'ssh');
    else if (!scopes.delete(ip)) return;
    await this.writeLines(
      'ssh-block-scope.tsv',
      [...scopes.entries()].map(([k, v]) => `${k}\t${v}`),
    );
  }

  private async appendLine(name: string, line: string) {
    await fs.appendFile(this.file(name), `${line}\n`, { mode: 0o644 });
  }
}

function cleanLabel(label: string | null | undefined): string | null {
  return (
    String(label ?? '')
      .replace(/[\t\r\n]+/g, ' ')
      .trim()
      .slice(0, 40) || null
  );
}

/** 방화벽 차단 대상은 IP 하나이거나, 로그인 차단이 올리는 IPv6 /64 대역이다. */
function normalizeBlockTarget(value: string): string {
  const text = String(value ?? '').trim();
  if (!text.includes('/')) return normalizeIp(text);
  if (!parseIpRange(text)) {
    throw new BadRequestException('IP 주소나 대역 형식이 아닙니다');
  }
  return text;
}

function normalizeIp(ip: string): string {
  const value = String(ip ?? '')
    .trim()
    .replace(/^::ffff:/i, '');
  if (!isIP(value)) throw new BadRequestException('IP 주소 형식이 아닙니다');
  return value;
}

/** 기록 파일과 같은 맥미니 로컬 시각 형식 (YYYY-MM-DD HH:MM:SS) */
export function formatLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours(),
  )}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
