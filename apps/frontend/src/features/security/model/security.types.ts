export type IpBanSource = 'manual' | 'auto-nginx' | 'auto-ssh' | 'auto-login';

export interface IpBan {
  id: string;
  ip: string;
  reason: string | null;
  source: IpBanSource;
  active: boolean;
  expiresAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIpBanInput {
  ip: string;
  reason?: string;
  ttlMinutes?: number;
}

export const TTL_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: '영구' },
  { value: 60, label: '1시간' },
  { value: 6 * 60, label: '6시간' },
  { value: 24 * 60, label: '24시간' },
  { value: 7 * 24 * 60, label: '7일' },
  { value: 30 * 24 * 60, label: '30일' },
];

// ---- SSH 접속 ----

/** IP 한 개의 위치 (DB-IP City Lite). 위치 파일이 없거나 내부 주소면 null */
export interface IpGeo {
  country: string;
  countryName: string;
  city: string | null;
  lat: number;
  lon: number;
}

export type SshAuditResult =
  '성공' | '실패' | '없는계정' | '시도초과' | '인증중끊김';
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
  geo: IpGeo | null;
}

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

/** 차단 범위 — all: 모든 접속(SSH·운영 사이트), ssh: SSH 만 */
export type SshBlockScope = 'all' | 'ssh';

export interface SshBlock {
  ip: string;
  source: 'auto' | 'manual';
  blockedAt: string | null;
  reason: string | null;
  scope: SshBlockScope;
  geo: IpGeo | null;
}

export interface SshKnownIp {
  ip: string;
  label: string | null;
}

export interface SshFirewallBlocks {
  guard: SshAccessOverview['guard'];
  items: SshBlock[];
}

export interface SshAccessOverview {
  recorder: { logPath: string; exists: boolean; updatedAt: string | null };
  guard: {
    installed: boolean;
    running: boolean;
    updatedAt: string | null;
    pfEnabled: boolean | null;
    blockedCount: number | null;
    allCount: number | null;
    sshOnlyCount: number | null;
  };
  summary: {
    since: string;
    total: number;
    externalSuccess: number;
    externalFailure: number;
    unknownExternalSuccessIps: number;
    ips: SshIpSummary[];
    triedUsers: Array<{ user: string; count: number }>;
  };
  events: SshAuditEvent[];
  sessions: SshSession[];
  pendingAuth: number;
  knownIps: SshKnownIp[];
  blocks: SshBlock[];
}

// ---- 공격 지도 ----

export interface AttackPoint {
  ip: string;
  geo: IpGeo | null;
  ssh: { failures: number; successes: number };
  web: { failures: number };
  attempts: number;
  blocked: boolean;
  lastAt: string;
}

export interface AttackCountry {
  /** 위치를 못 찾은 IP 묶음은 null */
  country: string | null;
  countryName: string | null;
  attempts: number;
  ips: number;
  blockedIps: number;
}

/** off: 위치 파일 경로 없음, loading: 기동 중 읽는 중, unavailable: 파일을 못 읽음 */
export type AttackMapView =
  | { enabled: false; reason: 'off' | 'loading' | 'unavailable' }
  | {
      enabled: true;
      builtAt: string;
      since: string;
      points: AttackPoint[];
      countries: AttackCountry[];
    };
