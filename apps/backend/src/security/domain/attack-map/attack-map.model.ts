/**
 * 공격 지도 — SSH 기록과 Control 로그인 실패를 IP 별로 합치고 나라별로 묶는다 (순수 함수)
 */
import type { IpGeo } from '../repositories/ip-geo.reader';
import { classifySshIp, type SshIpSummary } from '../ssh-audit/ssh-audit.model';

/** Control 웹 로그인에서 IP 하나가 실패하거나 거절당한 횟수 */
export interface WebLoginFailures {
  ip: string;
  failures: number;
  /** 맥 로컬 시각 (YYYY-MM-DD HH:MM:SS) */
  lastAt: string;
}

export interface AttackPoint {
  ip: string;
  geo: IpGeo | null;
  ssh: { failures: number; successes: number };
  web: { failures: number };
  /** 핀 크기 — SSH 실패·성공과 웹 로그인 실패를 모두 더한 수 */
  attempts: number;
  blocked: boolean;
  lastAt: string;
}

export interface AttackCountry {
  /** 위치를 못 찾은 IP 는 null 로 묶는다 */
  country: string | null;
  countryName: string | null;
  attempts: number;
  ips: number;
  blockedIps: number;
}

export function buildAttackMap(input: {
  ssh: SshIpSummary[];
  web: WebLoginFailures[];
  knownIps: ReadonlySet<string>;
  isBlocked: (ip: string) => boolean;
  geoOf: (ip: string) => IpGeo | null;
}): { points: AttackPoint[]; countries: AttackCountry[] } {
  const byIp = new Map<string, AttackPoint>();
  const row = (ip: string, lastAt: string): AttackPoint => {
    let point = byIp.get(ip);
    if (!point) {
      point = {
        ip,
        geo: null,
        ssh: { failures: 0, successes: 0 },
        web: { failures: 0 },
        attempts: 0,
        blocked: false,
        lastAt,
      };
      byIp.set(ip, point);
    }
    if (lastAt > point.lastAt) point.lastAt = lastAt;
    return point;
  };
  // 내 IP 와 맥미니·내부망·Tailscale 은 공격이 아니므로 뺀다
  const isAttacker = (ip: string) =>
    classifySshIp(ip) === 'external' && !input.knownIps.has(ip);

  for (const s of input.ssh) {
    if (!isAttacker(s.ip) || s.failure + s.success === 0) continue;
    const point = row(s.ip, s.lastAt);
    point.ssh.failures += s.failure;
    point.ssh.successes += s.success;
  }
  for (const w of input.web) {
    if (!isAttacker(w.ip) || w.failures === 0) continue;
    row(w.ip, w.lastAt).web.failures += w.failures;
  }

  const points = [...byIp.values()]
    .map((p) => ({
      ...p,
      geo: input.geoOf(p.ip),
      attempts: p.ssh.failures + p.ssh.successes + p.web.failures,
      blocked: input.isBlocked(p.ip),
    }))
    .sort(
      (a, b) => b.attempts - a.attempts || b.lastAt.localeCompare(a.lastAt),
    );

  const byCountry = new Map<string | null, AttackCountry>();
  for (const p of points) {
    const key = p.geo?.country ?? null;
    let c = byCountry.get(key);
    if (!c) {
      c = {
        country: key,
        countryName: p.geo?.countryName ?? null,
        attempts: 0,
        ips: 0,
        blockedIps: 0,
      };
      byCountry.set(key, c);
    }
    c.attempts += p.attempts;
    c.ips += 1;
    if (p.blocked) c.blockedIps += 1;
  }
  // 위치를 모르는 묶음은 순위가 아니므로 늘 맨 끝에 둔다
  const countries = [...byCountry.values()].sort(
    (a, b) =>
      Number(a.country === null) - Number(b.country === null) ||
      b.attempts - a.attempts ||
      b.ips - a.ips,
  );
  return { points, countries };
}
