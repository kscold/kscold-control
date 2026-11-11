/**
 * 로그인 시도가 어디서 왔는지. 규칙은 이 값으로 갈린다.
 * - vouched: 운영자가 적어 둔 주소(SECURITY_ALLOWLIST, SSH 내 IP). 세지도 막지도 않는다.
 * - internal: 막을 수 없거나 누구인지 모르는 주소(루프백, 사설망, Tailscale, 프록시 자신, 주소 없음). 계정 규칙만 걸린다.
 * - external: 그 밖의 주소. 모든 규칙이 걸린다.
 */
export type LoginOrigin = 'vouched' | 'internal' | 'external';

/** refused 는 비밀번호를 보기 전에 돌려보낸 시도다. */
export type LoginAttemptResult = 'success' | 'failure' | 'refused';

export type LoginAttemptReason =
  'wrong-password' | 'unknown-account' | 'ip-banned' | 'account-locked';

export interface LoginSubject {
  ip: string | null;
  /** 입력한 이메일을 정규화한 값. 없는 계정이어도 같은 규칙으로 센다. */
  account: string;
  origin: LoginOrigin;
}

export interface LoginAttemptRecord extends LoginSubject {
  result: LoginAttemptResult;
  at: Date;
}

export interface LoginBlockPolicy {
  ipBan: { attempts: number; windowMs: number; banMs: number };
  firewall: { attempts: number; windowMs: number };
  account: { attempts: number; windowMs: number; lockMs: number };
  retentionMs: number;
}

export interface LoginBlockDecision {
  /** 이 IP 를 nginx 에서 이 시각까지 막아야 한다. */
  ipBanUntil: Date | null;
  /** 이 IP 를 호스트 방화벽 차단 목록에 올려야 한다(자동 해제 없음). */
  firewall: boolean;
  /** 이 계정의 로그인을 이 시각까지 거절한다. */
  accountLockedUntil: Date | null;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const LOGIN_BLOCK_POLICY: LoginBlockPolicy = {
  ipBan: { attempts: 5, windowMs: 15 * MINUTE, banMs: HOUR },
  firewall: { attempts: 20, windowMs: DAY },
  account: { attempts: 10, windowMs: 15 * MINUTE, lockMs: 15 * MINUTE },
  retentionMs: 30 * DAY,
};

export function normalizeLoginAccount(email: string): string {
  return email.trim().toLowerCase().slice(0, 320);
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
 * IP 규칙은 돌려보낸 시도까지 센다. 429 를 받고도 계속 두드리는 IP 가 방화벽까지 올라가게 하려는 것이다.
 * 계정 규칙은 실제로 틀린 시도만 센다. 거절된 시도까지 세면 공격이 이어지는 동안 잠금이 끝나지 않는다.
 */
export function decideLoginBlock(
  subject: LoginSubject,
  attempts: readonly LoginAttemptRecord[],
  now: Date,
  policy: LoginBlockPolicy = LOGIN_BLOCK_POLICY,
): LoginBlockDecision {
  const at = now.getTime();
  const ipStrikes =
    subject.origin === 'external'
      ? attempts
          .filter(
            (a) =>
              a.ip === subject.ip &&
              a.origin === 'external' &&
              a.result !== 'success',
          )
          .map((a) => a.at.getTime())
      : [];
  const accountFailures =
    subject.origin === 'vouched'
      ? []
      : attempts
          .filter(
            (a) =>
              a.account === subject.account &&
              a.origin !== 'vouched' &&
              a.result === 'failure',
          )
          .map((a) => a.at.getTime());

  const ipBurst = lastBurstAt(
    ipStrikes,
    policy.ipBan.attempts,
    policy.ipBan.windowMs,
  );
  const accountBurst = lastBurstAt(
    accountFailures,
    policy.account.attempts,
    policy.account.windowMs,
  );
  const strikesToday = ipStrikes.filter(
    (t) => t > at - policy.firewall.windowMs && t <= at,
  ).length;

  return {
    ipBanUntil: activeUntil(ipBurst, policy.ipBan.banMs, at),
    firewall: strikesToday >= policy.firewall.attempts,
    accountLockedUntil: activeUntil(accountBurst, policy.account.lockMs, at),
  };
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
