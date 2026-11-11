import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { MfaChallengeToken } from '../../application/dto/login-result';

export const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const MFA_CHALLENGE_MAX_FAILURES = 5;
export const MFA_CHALLENGES_PER_USER = 3;
export const MFA_CHALLENGES_TOTAL = 1000;

export type MfaChallenge =
  | { purpose: 'verify'; userId: string }
  | {
      purpose: 'enroll';
      userId: string;
      secret: string;
      /** 로그인한 화면에서 시작한 등록이면 그 세션. 첫 로그인 등록이면 null. */
      sessionId: string | null;
    };

interface PendingChallenge {
  challenge: MfaChallenge;
  expiresAt: number;
  failures: number;
  checking: boolean;
}

export type BeginResult<P extends MfaChallenge['purpose']> =
  Extract<MfaChallenge, { purpose: P }> | 'busy' | null;

@Injectable()
export class MfaChallengeStore {
  // 만료 시간이 모두 같아 넣은 순서가 곧 만료 순서다. 앞에서부터만 지우면 된다.
  private readonly pending = new Map<string, PendingChallenge>();
  private readonly tokensByUser = new Map<string, string[]>();

  issue(challenge: MfaChallenge, now = new Date()): MfaChallengeToken {
    this.sweep(now.getTime());
    const own = this.tokensByUser.get(challenge.userId) ?? [];
    for (const old of own.slice(0, own.length - MFA_CHALLENGES_PER_USER + 1)) {
      this.remove(old);
    }
    if (this.pending.size >= MFA_CHALLENGES_TOTAL) {
      this.remove(this.pending.keys().next().value!);
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = now.getTime() + MFA_CHALLENGE_TTL_MS;
    this.pending.set(token, {
      challenge,
      expiresAt,
      failures: 0,
      checking: false,
    });
    this.tokensByUser.set(challenge.userId, [
      ...(this.tokensByUser.get(challenge.userId) ?? []),
      token,
    ]);
    return { token, expiresAt: new Date(expiresAt).toISOString() };
  }

  /** 코드를 확인하는 동안 같은 challenge 로 다른 확인이 들어오지 못하게 잡는다. `finish` 로 놓는다. */
  begin<P extends MfaChallenge['purpose']>(
    token: string,
    purpose: P,
    now = new Date(),
  ): BeginResult<P> {
    const entry = this.pending.get(token);
    if (!entry || entry.expiresAt <= now.getTime()) {
      this.remove(token);
      return null;
    }
    if (entry.challenge.purpose !== purpose) return null;
    if (entry.checking) return 'busy';
    entry.checking = true;
    return entry.challenge as Extract<MfaChallenge, { purpose: P }>;
  }

  finish(token: string) {
    const entry = this.pending.get(token);
    if (entry) entry.checking = false;
  }

  fail(token: string): number {
    const entry = this.pending.get(token);
    if (!entry) return 0;
    entry.failures += 1;
    const remaining = MFA_CHALLENGE_MAX_FAILURES - entry.failures;
    if (remaining <= 0) this.remove(token);
    return Math.max(0, remaining);
  }

  consume(token: string): boolean {
    return this.remove(token);
  }

  private remove(token: string): boolean {
    const entry = this.pending.get(token);
    if (!entry) return false;
    this.pending.delete(token);
    const { userId } = entry.challenge;
    const rest = (this.tokensByUser.get(userId) ?? []).filter(
      (owned) => owned !== token,
    );
    if (rest.length > 0) this.tokensByUser.set(userId, rest);
    else this.tokensByUser.delete(userId);
    return true;
  }

  private sweep(now: number) {
    for (const [token, entry] of this.pending) {
      if (entry.expiresAt > now) return;
      this.remove(token);
    }
  }
}
