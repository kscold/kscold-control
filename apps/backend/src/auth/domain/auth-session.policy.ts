import type { AuthSession } from './entities/auth-session.entity';

const DAY_MS = 24 * 60 * 60 * 1000;

export const SESSION_IDLE_TTL_MS = 7 * DAY_MS;
export const SESSION_ABSOLUTE_TTL_MS = 30 * DAY_MS;
/** 요청마다 쓰지 않도록 마지막 사용 시각은 이 간격에 한 번만 기록한다 */
export const SESSION_TOUCH_INTERVAL_MS = 60 * 1000;

export type SessionLifetime = Pick<
  AuthSession,
  'expiresAt' | 'absoluteExpiresAt' | 'revokedAt'
>;

/** 절대 수명이 유휴 수명보다 짧으면(미리보기) 두 만료가 같다. */
export function openingLifetime(
  now: Date,
  absoluteTtlMs = SESSION_ABSOLUTE_TTL_MS,
): Pick<SessionLifetime, 'expiresAt' | 'absoluteExpiresAt'> {
  const absoluteExpiresAt = new Date(now.getTime() + absoluteTtlMs);
  return {
    expiresAt: extendedExpiry({ absoluteExpiresAt }, now),
    absoluteExpiresAt,
  };
}

export function extendedExpiry(
  session: Pick<SessionLifetime, 'absoluteExpiresAt'>,
  now: Date,
): Date {
  return new Date(
    Math.min(
      now.getTime() + SESSION_IDLE_TTL_MS,
      session.absoluteExpiresAt.getTime(),
    ),
  );
}

/** 유휴 만료는 절대 만료를 넘지 않으므로(DB CHECK 도 같음) 유휴 만료만 보면 된다. */
export function isSessionActive(
  session: Pick<SessionLifetime, 'expiresAt' | 'revokedAt'>,
  now: Date,
): boolean {
  return !session.revokedAt && now < session.expiresAt;
}
