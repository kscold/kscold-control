import { MfaChallengeStore } from '@/auth/mfa/application/mfa-challenge.store';
import { MfaService } from '@/auth/mfa/application/mfa.service';
import type { MfaFailureReason } from '@/auth/mfa/domain/mfa-attempt-guard';
import type { UserMfa } from '@/auth/mfa/domain/user-mfa.entity';
import type { IUserMfaRepository } from '@/auth/mfa/domain/user-mfa.repository.interface';
import { sessionHarness } from './auth-session.fake';

export class InMemoryUserMfaRepository implements IUserMfaRepository {
  readonly rows = new Map<string, UserMfa>();

  async find(userId: string) {
    const row = this.rows.get(userId);
    return row
      ? { ...row, recoveryCodeHashes: [...row.recoveryCodeHashes] }
      : null;
  }

  async createIfAbsent(enrollment: UserMfa) {
    if (this.rows.has(enrollment.userId)) return false;
    this.rows.set(enrollment.userId, { ...enrollment });
    return true;
  }

  async claimTotpStep(userId: string, step: number) {
    const row = this.rows.get(userId);
    if (!row || row.lastUsedStep >= step) return false;
    row.lastUsedStep = step;
    return true;
  }

  async consumeRecoveryCode(userId: string, codeHash: string) {
    const row = this.rows.get(userId);
    if (!row?.recoveryCodeHashes.includes(codeHash)) return false;
    row.recoveryCodeHashes = row.recoveryCodeHashes.filter(
      (hash) => hash !== codeHash,
    );
    return true;
  }

  async replaceRecoveryCodes(userId: string, codeHashes: string[]) {
    const row = this.rows.get(userId);
    if (row) row.recoveryCodeHashes = [...codeHashes];
  }
}

export function account(id: string, role: string, email = `${id}@example.com`) {
  return {
    id,
    email,
    password: 'unused',
    roles: [{ name: role, permissions: [{ name: 'dashboard:read' }] }],
  };
}

export function mfaHarness() {
  const sessions = sessionHarness({ mfaRequiredRoles: ['admin'] });
  const enrollments = new InMemoryUserMfaRepository();
  const users = new Map<string, ReturnType<typeof account>>();
  const failures: Array<{ email: string; reason: MfaFailureReason }> = [];
  const guard = {
    admit: async (_ip: string | null, email: string) => ({ email }),
    failed: async (attempt: unknown, reason: MfaFailureReason) => {
      failures.push({ email: (attempt as { email: string }).email, reason });
    },
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const mfa = new MfaService(
    enrollments,
    { findByIdWithRoles: async (id: string) => users.get(id) ?? null } as any,
    guard,
    sessions.mfaConfig,
    new MfaChallengeStore(),
    sessions.sessions,
    audit as any,
  );
  return {
    ...sessions,
    enrollments,
    users,
    failures,
    audit,
    mfa,
    addUser(user: ReturnType<typeof account>) {
      users.set(user.id, user);
      return user;
    },
  };
}
