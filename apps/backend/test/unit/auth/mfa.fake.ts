import * as bcrypt from 'bcrypt';
import { MfaChallengeStore } from '@/auth/mfa/application/mfa-challenge.store';
import { MfaService } from '@/auth/mfa/application/mfa.service';
import type { LoginAttemptReason } from '@/security/domain/login-guard/login-block.policy';
import type { UserMfa } from '@/auth/mfa/domain/user-mfa.entity';
import type { IUserMfaRepository } from '@/auth/mfa/domain/user-mfa.repository.interface';
import { loginGuardHarness } from '../security/login-guard.fake';
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

const openHarnesses: Array<() => Promise<void>> = [];

/** 하네스마다 만든 임시 폴더와 SSH_AUDIT_DIR 을 치운다. afterEach 에서 부른다. */
export async function closeMfaHarnesses() {
  await Promise.all(openHarnesses.splice(0).map((cleanup) => cleanup()));
}

/** 2단계 코드 실패는 실제 로그인 차단(LoginGuardService)이 센다. */
export async function mfaHarness(options: { allowlist?: string } = {}) {
  const loginGuard = await loginGuardHarness(options);
  openHarnesses.push(loginGuard.cleanup);
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
    loginGuard.guard,
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
    loginGuard,
    failures: (): Array<{ email: string; reason: LoginAttemptReason | null }> =>
      loginGuard.attempts.rows
        .filter((row) => row.result === 'failure')
        .map((row) => ({ email: row.account, reason: row.reason })),
    mfa,
    addUser(user: ReturnType<typeof account>) {
      users.set(user.id, user);
      return user;
    },
  };
}
