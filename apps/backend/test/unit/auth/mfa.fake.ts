import * as bcrypt from 'bcrypt';
import { MfaChallengeStore } from '@/auth/mfa/application/mfa-challenge.store';
import { MfaService } from '@/auth/mfa/application/mfa.service';
import type { MfaFailureReason } from '@/auth/mfa/domain/mfa-attempt-guard';
import { AccountMfaAttemptGuard } from '@/auth/mfa/infrastructure/account-mfa-attempt-guard';
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

export const PASSWORD = 'correct horse battery';
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);

export function account(id: string, role: string, email = `${id}@example.com`) {
  return {
    id,
    email,
    password: PASSWORD_HASH,
    roles: [{ name: role, permissions: [{ name: 'dashboard:read' }] }],
  };
}

export function mfaHarness() {
  const users = new Map<string, ReturnType<typeof account>>();
  const sessions = sessionHarness({ mfaRequiredRoles: ['admin'], users });
  const enrollments = new InMemoryUserMfaRepository();
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const auditActions = (action: string) =>
    audit.record.mock.calls
      .map(([event]) => event)
      .filter((event) => event.action === action);
  const challenges = new MfaChallengeStore();
  const mfa = new MfaService(
    enrollments,
    { findByIdWithRoles: async (id: string) => users.get(id) ?? null } as any,
    new AccountMfaAttemptGuard(audit as any),
    sessions.mfaConfig,
    challenges,
    sessions.sessions,
    audit as any,
  );
  return {
    ...sessions,
    enrollments,
    users,
    audit,
    auditActions,
    challenges,
    failures: (): Array<{ email: string; reason: MfaFailureReason }> =>
      auditActions('login.mfa-failure').map((event) => ({
        email: event.metadata.email,
        reason: event.metadata.reason,
      })),
    mfa,
    addUser(user: ReturnType<typeof account>) {
      users.set(user.id, user);
      return user;
    },
  };
}
