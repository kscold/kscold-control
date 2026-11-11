import { ISO_COUNTRY_CODES } from './iso-country-codes';
import { classifySshIp, type SshAuditEvent } from './ssh-audit.model';

/** 허용 국가 밖 SSH 차단 설정. 저장된 값이 없으면 한국만 허용하고 켠다. */
export interface CountryGuardSettings {
  enabled: boolean;
  /** ISO 3166-1 두 글자, 정렬·중복 제거됨 */
  allowedCountries: string[];
}

export const DEFAULT_COUNTRY_GUARD_SETTINGS: CountryGuardSettings = {
  enabled: true,
  allowedCountries: ['KR'],
};

/** 대문자로 맞춰 정렬·중복 제거한 코드와, ISO 3166-1 에 없는 값 */
export function parseCountries(codes: readonly unknown[]): {
  codes: string[];
  unknown: string[];
} {
  const values = codes.map((code) =>
    typeof code === 'string' ? code.trim().toUpperCase() : String(code),
  );
  return {
    codes: [...new Set(values.filter((v) => ISO_COUNTRY_CODES.has(v)))].sort(),
    unknown: values.filter((v) => !ISO_COUNTRY_CODES.has(v)),
  };
}

/**
 * contact: 접속만 함(성공·인증 중 끊김) → SSH 만 막는다. 사이트는 계속 열어 둔다.
 * attack: 비밀번호 실패·없는 계정·root·시도 초과 → 기존 공격 규칙처럼 SSH·사이트 모두 막는다.
 */
export type CountryBlockKind = 'contact' | 'attack';

const KIND_LABEL: Record<CountryBlockKind, string> = {
  contact: '접속',
  attack: '공격',
};
const REASON_RE = /^허용 국가 밖 SSH (접속|공격) \(([A-Z]{2})[,)]/;

export function countryBlockReason(
  kind: CountryBlockKind,
  country: string,
  users: readonly string[],
): string {
  const who = users.length > 0 ? `, user=${users.slice(0, 3).join(',')}` : '';
  return `허용 국가 밖 SSH ${KIND_LABEL[kind]} (${country}${who})`;
}

/** 차단 이유가 이 규칙이 쓴 것이면 종류와 나라 */
export function parseCountryBlockReason(
  reason: string | null,
): { kind: CountryBlockKind; country: string } | null {
  const m = REASON_RE.exec(reason ?? '');
  if (!m) return null;
  return { kind: m[1] === '공격' ? 'attack' : 'contact', country: m[2] };
}

/**
 * none: 막혀 있지 않음
 * widenable: 이 규칙이 SSH 만 막아 둔 접속 차단 → 공격이 보이면 모든 접속으로 넓힌다
 * other: 다른 규칙이나 운영자가 정한 차단 → 건드리지 않는다
 */
export type ExistingBlock = 'none' | 'widenable' | 'other';

export interface CountryGuardContext {
  allowed: ReadonlySet<string>;
  /** 위치를 모르면 null */
  countryOf: (ip: string) => string | null;
  /** 내 IP·허용 목록 등 막지 않는 주소 */
  isExempt: (ip: string) => boolean;
  existing: (ip: string) => ExistingBlock;
}

export interface CountryBlockAction {
  ip: string;
  country: string;
  kind: CountryBlockKind;
  action: 'block' | 'widen';
  users: string[];
  /** 로그인이 성공한 적 있음 — 침입 신호 */
  succeeded: boolean;
}

function isAttack(e: SshAuditEvent): boolean {
  return (
    e.result === '실패' ||
    e.result === '없는계정' ||
    e.result === '시도초과' ||
    e.user === 'root'
  );
}

/** 접속 기록에서 허용 국가 밖 외부 IP 를 골라 할 일을 정한다. 같은 기록을 다시 넣어도 이미 한 일은 다시 고르지 않는다. */
export function planCountryBlocks(
  events: readonly SshAuditEvent[],
  ctx: CountryGuardContext,
): { actions: CountryBlockAction[]; unknownCountryIps: number } {
  const byIp = new Map<
    string,
    { attack: boolean; succeeded: boolean; users: Set<string> }
  >();
  for (const e of events) {
    if (!e.ip || e.scope !== 'external') continue;
    const ip = e.ip.replace(/^::ffff:/i, '');
    const row = byIp.get(ip) ?? {
      attack: false,
      succeeded: false,
      users: new Set<string>(),
    };
    row.attack ||= isAttack(e);
    row.succeeded ||= e.result === '성공';
    if (e.user) row.users.add(e.user);
    byIp.set(ip, row);
  }

  const actions: CountryBlockAction[] = [];
  let unknownCountryIps = 0;
  for (const [ip, row] of byIp) {
    if (classifySshIp(ip) !== 'external' || ctx.isExempt(ip)) continue;
    const existing = ctx.existing(ip);
    if (existing === 'other') continue;
    if (existing === 'widenable' && !row.attack) continue;
    const country = ctx.countryOf(ip);
    if (!country) {
      unknownCountryIps += 1;
      continue;
    }
    if (ctx.allowed.has(country)) continue;
    actions.push({
      ip,
      country,
      kind: row.attack ? 'attack' : 'contact',
      action: existing === 'widenable' ? 'widen' : 'block',
      users: [...row.users],
      succeeded: row.succeeded,
    });
  }
  return { actions, unknownCountryIps };
}
