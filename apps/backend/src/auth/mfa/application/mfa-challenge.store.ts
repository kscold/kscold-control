import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { MfaChallengeToken } from '../../application/dto/login-result';

export const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const MFA_CHALLENGE_MAX_FAILURES = 5;

export type MfaChallenge =
  | { purpose: 'verify'; userId: string }
  | { purpose: 'enroll'; userId: string; secret: string };

interface PendingChallenge {
  challenge: MfaChallenge;
  expiresAt: number;
  failures: number;
}

@Injectable()
export class MfaChallengeStore {
  private readonly pending = new Map<string, PendingChallenge>();

  issue(challenge: MfaChallenge, now = new Date()): MfaChallengeToken {
    this.sweep(now.getTime());
    const token = randomBytes(32).toString('base64url');
    const expiresAt = now.getTime() + MFA_CHALLENGE_TTL_MS;
    this.pending.set(token, { challenge, expiresAt, failures: 0 });
    return { token, expiresAt: new Date(expiresAt).toISOString() };
  }

  find<P extends MfaChallenge['purpose']>(
    token: string,
    purpose: P,
    now = new Date(),
  ): Extract<MfaChallenge, { purpose: P }> | null {
    const entry = this.pending.get(token);
    if (!entry || entry.expiresAt <= now.getTime()) {
      this.pending.delete(token);
      return null;
    }
    return entry.challenge.purpose === purpose
      ? (entry.challenge as Extract<MfaChallenge, { purpose: P }>)
      : null;
  }

  fail(token: string): number {
    const entry = this.pending.get(token);
    if (!entry) return 0;
    entry.failures += 1;
    const remaining = MFA_CHALLENGE_MAX_FAILURES - entry.failures;
    if (remaining <= 0) this.pending.delete(token);
    return Math.max(0, remaining);
  }

  consume(token: string): boolean {
    return this.pending.delete(token);
  }

  private sweep(now: number) {
    for (const [token, entry] of this.pending) {
      if (entry.expiresAt <= now) this.pending.delete(token);
    }
  }
}
