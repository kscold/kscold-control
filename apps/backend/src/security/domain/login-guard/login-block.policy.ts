import { isIP } from 'node:net';

/**
 * 로그인 시도가 어디서 왔는지. 규칙은 이 값으로 갈리고, 계정 잠금도 출처마다 따로 센다.
 * 바깥에서 실패를 쌓아도 내부망·허용 목록에서의 로그인은 잠기지 않게 하려는 것이다.
 * - vouched: 운영자가 적어 둔 주소(SECURITY_ALLOWLIST, SSH 내 IP). IP 로 막지 않고, 계정 잠금은 더 넉넉하다.
 * - internal: 루프백·사설망·Tailscale·프록시 자신. IP 로 막지 않는다.
 * - external: 그 밖의 주소. 모든 규칙이 걸린다.
 * - unverified: 프록시 비밀값으로 확인하지 못한 주소. 꾸민 주소일 수 있어 IP 로 막지도 예외로 두지도 않는다.
 */
export type LoginOrigin = 'vouched' | 'internal' | 'external' | 'unverified';

/** refused 는 비밀번호를 보기 전에 돌려보낸 시도다. */
export type LoginAttemptResult = 'success' | 'failure' | 'refused';

export type LoginAttemptReason =
  'wrong-password' | 'unknown-account' | 'ip-banned' | 'account-locked';

export interface LoginSubject {
  /** 접속한 주소 그대로 */
  ip: string | null;
  /** IP 규칙을 세고 막는 단위. IPv4 는 주소 하나, IPv6 는 /64 대역이다. */
  ipGroup: string | null;
  /** 입력한 이메일을 정규화한 값. 없는 계정이어도 같은 규칙으로 센다. */
  account: string;
  origin: LoginOrigin;
}

export interface LoginAttemptRecord extends LoginSubject {
  result: LoginAttemptResult;
  reason: LoginAttemptReason | null;
  at: Date;
}

export interface LoginBlockPolicy {
  ipBan: { attempts: number; windowMs: number; banMs: number };
  /** 계정이 잠겨 돌려보낸 시도까지 합쳐 이만큼 몰리면, 사람이 아니라 기계가 두드리는 것으로 보고 IP 를 막는다. */
  ipFlood: { attempts: number; windowMs: number };
  firewall: { attempts: number; windowMs: number };
  account: {
    attempts: Record<LoginOrigin, number>;
    windowMs: number;
    lockMs: number;
  };
  retentionMs: number;
}

export interface LoginBlockDecision {
  /** 이 IP(대역)를 nginx 에서 이 시각까지 막아야 한다. */
  ipBanUntil: Date | null;
  /** 이 IP(대역)를 호스트 방화벽 차단 목록에 올려야 한다(자동 해제 없음). */
  firewall: boolean;
  /** 이 출처에서 이 계정의 로그인을 이 시각까지 거절한다. */
  accountLockedUntil: Date | null;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const LOGIN_BLOCK_POLICY: LoginBlockPolicy = {
  ipBan: { attempts: 5, windowMs: 15 * MINUTE, banMs: HOUR },
  ipFlood: { attempts: 60, windowMs: 15 * MINUTE },
  firewall: { attempts: 20, windowMs: DAY },
  account: {
    // 허용 목록 주소는 공유기 뒤 여러 사람일 수 있어 세기는 하되 넉넉하게 둔다.
    attempts: { external: 10, internal: 10, unverified: 10, vouched: 30 },
    windowMs: 15 * MINUTE,
    lockMs: 15 * MINUTE,
  },
  retentionMs: 30 * DAY,
};

/** C0·C1 제어 문자와 글자 방향을 바꾸는 문자. 감사 화면에서 계정 이름을 다르게 보이게 할 수 있다. */
// eslint-disable-next-line no-control-regex -- 제어 문자를 지우려는 것이다.
const INVISIBLE_CHARS = /[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/g;

export function normalizeLoginAccount(email: string): string {
  return email.replace(INVISIBLE_CHARS, '').trim().toLowerCase().slice(0, 320);
}

/**
 * IP 규칙을 세는 단위. IPv6 는 한 가입자가 /64 를 통째로 받아 주소를 바꿔 가며 시도할 수 있어 /64 로 묶는다.
 * 대역 표기는 WHATWG URL 의 IPv6 표기(소문자, 0 줄임)로 맞춰 같은 대역이 늘 같은 문자열이 되게 한다.
 */
export function loginIpGroup(ip: string | null): string | null {
  const address = ip?.split('%')[0] ?? null;
  if (!address || isIP(address) !== 6) return address;
  const canonical = new URL(`http://[${address}]`).hostname.slice(1, -1);
  const [head, tail = ''] = canonical.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = [
    ...left,
    ...Array<string>(8 - left.length - right.length).fill('0'),
    ...right,
  ];
  const network = new URL(`http://[${groups.slice(0, 4).join(':')}::]`)
    .hostname;
  return `${network.slice(1, -1)}/64`;
}

/** 판정에 필요한 기록을 어디까지 거슬러 읽을지 */
export function loginHistorySince(
  now: Date,
  policy: LoginBlockPolicy = LOGIN_BLOCK_POLICY,
): { ip: Date; account: Date } {
  const ipLookback = Math.max(
    policy.ipBan.windowMs + policy.ipBan.banMs,
    policy.firewall.windowMs,
  );
  const accountLookback = policy.account.windowMs + policy.account.lockMs;
  return {
    ip: new Date(now.getTime() - ipLookback),
    account: new Date(now.getTime() - accountLookback),
  };
}

/**
 * IP 실패로 세는 시도. 계정이 잠겨서 돌려보낸 시도는 세지 않는다.
 * 세면 공격으로 잠긴 계정에 몇 번 다시 시도한 운영자의 IP 가 막힌다.
 */
function isIpStrike(attempt: LoginAttemptRecord): boolean {
  return (
    attempt.result === 'failure' ||
    (attempt.result === 'refused' && attempt.reason === 'ip-banned')
  );
}

/**
 * IP 규칙은 확인된 외부 주소에만 걸고, 같은 IP(대역)의 외부 시도만 센다.
 * 계정 규칙은 같은 출처에서 실제로 틀린 시도만 센다. 거절된 시도까지 세면 공격이 이어지는 동안 잠금이 끝나지 않는다.
 */
export function decideLoginBlock(
  subject: LoginSubject,
  attempts: readonly LoginAttemptRecord[],
  now: Date,
  policy: LoginBlockPolicy = LOGIN_BLOCK_POLICY,
): LoginBlockDecision {
  const at = now.getTime();
  const fromIp =
    subject.origin === 'external'
      ? attempts.filter(
          (a) => a.origin === 'external' && a.ipGroup === subject.ipGroup,
        )
      : [];
  const ipStrikes = times(fromIp.filter(isIpStrike));
  const ipNoise = times(fromIp.filter((a) => a.result !== 'success'));
  const accountFailures = times(
    attempts.filter(
      (a) =>
        a.account === subject.account &&
        a.origin === subject.origin &&
        a.result === 'failure',
    ),
  );

  const strikesToday = ipStrikes.filter(
    (t) => t > at - policy.firewall.windowMs && t <= at,
  ).length;
  const banFrom = latest(
    lastBurstAt(ipStrikes, policy.ipBan.attempts, policy.ipBan.windowMs),
    lastBurstAt(ipNoise, policy.ipFlood.attempts, policy.ipFlood.windowMs),
  );

  return {
    ipBanUntil: activeUntil(banFrom, policy.ipBan.banMs, at),
    firewall: strikesToday >= policy.firewall.attempts,
    accountLockedUntil: activeUntil(
      lastBurstAt(
        accountFailures,
        policy.account.attempts[subject.origin],
        policy.account.windowMs,
      ),
      policy.account.lockMs,
      at,
    ),
  };
}

function times(attempts: readonly LoginAttemptRecord[]): number[] {
  return attempts.map((a) => a.at.getTime());
}

function latest(...values: Array<number | null>): number | null {
  const known = values.filter((value): value is number => value !== null);
  return known.length > 0 ? Math.max(...known) : null;
}

/** `attempts` 번이 `windowMs` 보다 짧은 사이에 몰린 가장 늦은 순간 */
function lastBurstAt(
  times: number[],
  attempts: number,
  windowMs: number,
): number | null {
  const sorted = [...times].sort((a, b) => a - b);
  for (let i = sorted.length - 1; i >= attempts - 1; i--) {
    if (sorted[i] - sorted[i - attempts + 1] < windowMs) return sorted[i];
  }
  return null;
}

function activeUntil(
  burstAt: number | null,
  durationMs: number,
  now: number,
): Date | null {
  if (burstAt === null) return null;
  const end = burstAt + durationMs;
  return end > now ? new Date(end) : null;
}
