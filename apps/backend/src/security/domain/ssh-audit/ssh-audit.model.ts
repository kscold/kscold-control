/**
 * SSH 접속 기록 도메인 — 기록 한 줄 해석, IP 구분, 요약 계산 (순수 함수)
 *
 * 기록 파일은 root LaunchDaemon(com.kscold.ssh-audit)이 쓰는 TSV 6칸이다.
 * 시각(KST) · 결과 · 계정 · 접속 IP · 방식 · 원문 요약
 */

export const SSH_AUDIT_RESULTS = [
  '성공',
  '실패',
  '없는계정',
  '시도초과',
  '인증중끊김',
] as const;

export type SshAuditResult = (typeof SSH_AUDIT_RESULTS)[number];

/** 접속 IP 출처 구분 — 맥미니 자신, 집 내부망, Tailscale, 외부 */
export type SshIpScope = 'local' | 'lan' | 'tailscale' | 'external' | 'unknown';

export interface SshAuditEvent {
  at: string;
  result: SshAuditResult;
  user: string | null;
  ip: string | null;
  method: string | null;
  message: string;
  scope: SshIpScope;
}

export interface SshIpSummary {
  ip: string;
  scope: SshIpScope;
  known: boolean;
  success: number;
  failure: number;
  users: string[];
  firstAt: string;
  lastAt: string;
}

export interface SshAuditSummary {
  since: string;
  total: number;
  externalSuccess: number;
  externalFailure: number;
  /** 외부에서 성공했는데 내 IP 목록에 없는 IP 수 — 가장 먼저 봐야 할 숫자 */
  unknownExternalSuccessIps: number;
  ips: SshIpSummary[];
  triedUsers: Array<{ user: string; count: number }>;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/** 기록 한 줄을 해석한다. 형식이 다르면 null */
export function parseSshAuditLine(line: string): SshAuditEvent | null {
  const cols = line.replace(/\r$/, '').split('\t');
  if (cols.length < 5) return null;
  const [at, result, user, ip, method, ...rest] = cols;
  if (!DATE_RE.test(at)) return null;
  if (!(SSH_AUDIT_RESULTS as readonly string[]).includes(result)) return null;
  const cleanIp = dash(ip);
  return {
    at,
    result: result as SshAuditResult,
    user: dash(user),
    ip: cleanIp,
    method: dash(method),
    message: rest.join('\t').slice(0, 200),
    scope: classifySshIp(cleanIp),
  };
}

function dash(value: string | undefined): string | null {
  const v = (value ?? '').trim();
  return v === '' || v === '-' ? null : v;
}

/** 접속 IP 출처 구분 — 요약 스크립트(ssh-audit-report.sh)와 같은 기준 */
export function classifySshIp(ip: string | null): SshIpScope {
  if (!ip) return 'unknown';
  const v = ip.replace(/^::ffff:/i, '');
  if (v === '::1' || v.startsWith('127.')) return 'local';
  if (v.startsWith('192.168.') || v.startsWith('10.')) return 'lan';
  const m = /^100\.(\d+)\./.exec(v);
  if (m && Number(m[1]) >= 64 && Number(m[1]) <= 127) return 'tailscale';
  return 'external';
}

/** 실패로 세는 결과 — 인증 중 끊김은 정상 키 협상에서도 나와 실패로 세지 않음 */
function isFailure(result: SshAuditResult): boolean {
  return result === '실패' || result === '없는계정' || result === '시도초과';
}

export function summarizeSshAudit(
  events: SshAuditEvent[],
  knownIps: ReadonlySet<string>,
  since: string,
): SshAuditSummary {
  const byIp = new Map<string, SshIpSummary & { userSet: Set<string> }>();
  const users = new Map<string, number>();
  let externalSuccess = 0;
  let externalFailure = 0;

  for (const e of events) {
    if (e.user && (e.result === '실패' || e.result === '없는계정')) {
      users.set(e.user, (users.get(e.user) ?? 0) + 1);
    }
    if (!e.ip) continue;
    const success = e.result === '성공';
    const failure = isFailure(e.result);
    if (e.scope === 'external') {
      if (success) externalSuccess += 1;
      if (failure) externalFailure += 1;
    }
    let row = byIp.get(e.ip);
    if (!row) {
      row = {
        ip: e.ip,
        scope: e.scope,
        known: knownIps.has(e.ip),
        success: 0,
        failure: 0,
        users: [],
        userSet: new Set(),
        firstAt: e.at,
        lastAt: e.at,
      };
      byIp.set(e.ip, row);
    }
    if (success) row.success += 1;
    if (failure) row.failure += 1;
    if (e.user) row.userSet.add(e.user);
    if (e.at < row.firstAt) row.firstAt = e.at;
    if (e.at > row.lastAt) row.lastAt = e.at;
  }

  const ips = [...byIp.values()]
    .map(({ userSet, ...row }) => ({
      ...row,
      users: [...userSet].slice(0, 10),
    }))
    .sort(
      (a, b) =>
        priority(b) - priority(a) ||
        b.failure + b.success - (a.failure + a.success) ||
        (b.lastAt > a.lastAt ? 1 : -1),
    );

  return {
    since,
    total: events.length,
    externalSuccess,
    externalFailure,
    unknownExternalSuccessIps: ips.filter(
      (r) => r.scope === 'external' && r.success > 0 && !r.known,
    ).length,
    ips,
    triedUsers: [...users.entries()]
      .map(([user, count]) => ({ user, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  };
}

/** 정렬 우선순위 — 처음 보는 외부 성공 > 외부 성공 > 외부 실패 > 나머지 */
function priority(r: SshIpSummary): number {
  if (r.scope !== 'external') return 0;
  if (r.success > 0 && !r.known) return 3;
  if (r.success > 0) return 2;
  return 1;
}

/** ps 의 command 가 인증을 마친 SSH 세션 프로세스인지 — 예: "sshd-session: kscold@notty" */
export function parseSshSessionCommand(
  command: string,
): { user: string; tty: string | null } | null {
  const m = /^sshd(?:-session)?: ([^\s@[]+)(?:@(\S+))?\s*$/.exec(
    command.trim(),
  );
  if (!m) return null;
  return { user: m[1], tty: m[2] && m[2] !== 'notty' ? m[2] : null };
}

/** lsof 의 "로컬->원격" 주소에서 원격 IP·포트만 뽑는다 */
export function parseRemoteEndpoint(
  name: string,
): { ip: string; port: number } | null {
  const arrow = name.indexOf('->');
  if (arrow < 0) return null;
  const remote = name.slice(arrow + 2).replace(/\s*\(.*\)$/, '');
  const m = /^\[?([^\]]+?)\]?:(\d+)$/.exec(remote);
  if (!m) return null;
  return { ip: m[1], port: Number(m[2]) };
}
