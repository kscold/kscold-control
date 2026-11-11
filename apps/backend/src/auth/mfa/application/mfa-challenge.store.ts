import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { MfaChallengeToken } from '../../application/dto/login-result';

export const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000;
/** 한 challenge 에서 틀릴 수 있는 횟수. 넘으면 비밀번호부터 다시 시작한다. */
export const MFA_CHALLENGE_MAX_FAILURES = 5;

/** 비밀번호만 맞힌 상태. 세션이 아니라서 2단계 확인과 등록 요청에만 쓸 수 있다. */
export type MfaChallenge =
  | { purpose: 'verify'; userId: string }
  /** 등록 중인 비밀값은 코드를 맞혀 등록을 마칠 때까지 메모리에만 둔다. */
  | { purpose: 'enroll'; userId: string; secret: string };

interface PendingChallenge {
  challenge: MfaChallenge;
  expiresAt: number;
  failures: number;
}

/**
 * 5분짜리 일회용 challenge. 백엔드는 한 프로세스로만 돌므로(ecosystem instances=1)
 * 메모리에 두고, 재시작하면 진행 중이던 사용자는 비밀번호부터 다시 입력한다.
 */
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

  /** 실패를 하나 세고 남은 횟수를 돌려준다. 0 이면 challenge 는 닫혔다. */
  fail(token: string): number {
    const entry = this.pending.get(token);
    if (!entry) return 0;
    entry.failures += 1;
    const remaining = MFA_CHALLENGE_MAX_FAILURES - entry.failures;
    if (remaining <= 0) this.pending.delete(token);
    return Math.max(0, remaining);
  }

  /** 동시에 맞힌 요청이 여럿이어도 처음 닫은 요청만 true 를 받는다. */
  close(token: string): boolean {
    return this.pending.delete(token);
  }

  private sweep(now: number) {
    for (const [token, entry] of this.pending) {
      if (entry.expiresAt <= now) this.pending.delete(token);
    }
  }
}
