import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { MfaConfig } from '@/auth/mfa/application/mfa-config';
import { AuthSessionService } from '@/auth/application/services/auth-session.service';
import { SessionConnectionRegistry } from '@/auth/application/services/session-connection-registry.service';
import { SessionVerifier } from '@/auth/application/services/session-verifier.service';
import type { AuthSession } from '@/auth/domain/entities/auth-session.entity';
import type { IAuthSessionRepository } from '@/auth/domain/repositories/auth-session.repository.interface';

/** TypeORM 저장소와 같은 규칙으로 메모리에 세션을 기록한다. writes 는 실제 UPDATE 횟수다. */
export class InMemoryAuthSessionRepository implements IAuthSessionRepository {
  readonly rows = new Map<string, AuthSession>();
  writes = 0;

  async open(input: Parameters<IAuthSessionRepository['open']>[0]) {
    const session: AuthSession = {
      ...input,
      id: `00000000-0000-4000-8000-${String(this.rows.size + 1).padStart(12, '0')}`,
      lastSeenAt: input.createdAt,
      stepUpUntil: null,
      revokedAt: null,
    };
    this.rows.set(session.id, session);
    return { ...session };
  }

  async findById(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      throw new Error(`invalid input syntax for type uuid: "${id}"`);
    }
    const session = this.rows.get(id);
    return session ? { ...session } : null;
  }

  async extend(id: string, expiresAt: Date) {
    this.update(id, { expiresAt });
  }

  async touch(id: string, at: Date) {
    this.update(id, { lastSeenAt: at });
  }

  async upgradeToMfa(id: string) {
    this.update(id, { assurance: 'mfa' });
  }

  async revoke(id: string, at: Date) {
    return this.revokeMatching(
      at,
      (session) => session.id === id || session.parentSessionId === id,
    );
  }

  async revokeForUser(userId: string, at: Date, keepSessionId: string | null) {
    const owned = new Set(
      [...this.rows.values()]
        .filter((session) => session.userId === userId)
        .map((session) => session.id),
    );
    return this.revokeMatching(
      at,
      (session) =>
        (owned.has(session.id) ||
          (session.parentSessionId !== null &&
            owned.has(session.parentSessionId))) &&
        (keepSessionId === null ||
          (session.id !== keepSessionId &&
            session.parentSessionId !== keepSessionId)),
    );
  }

  private revokeMatching(at: Date, match: (session: AuthSession) => boolean) {
    const revoked: string[] = [];
    for (const session of [...this.rows.values()]) {
      if (!session.revokedAt && match(session)) {
        this.update(session.id, { revokedAt: at });
        revoked.push(session.id);
      }
    }
    return revoked;
  }

  private update(id: string, patch: Partial<AuthSession>) {
    const session = this.rows.get(id);
    if (!session) return;
    this.rows.set(id, { ...session, ...patch });
    this.writes += 1;
  }
}

type StoredUser = { roles: Array<{ name: string }> };

export function sessionHarness({
  mfaRequiredRoles = [] as string[],
  users = new Map<string, StoredUser>(),
} = {}) {
  const repository = new InMemoryAuthSessionRepository();
  const jwtService = new JwtService({
    secret: 'test-only-secret-at-least-32-characters',
  });
  const mfaConfig = new MfaConfig(
    randomBytes(32),
    new Set(mfaRequiredRoles),
    'kscold-control',
  );
  const verifier = new SessionVerifier(repository, jwtService, mfaConfig, {
    findByIdWithRoles: async (id: string) => (users.get(id) as any) ?? null,
  });
  const connections = new SessionConnectionRegistry(verifier);
  return {
    repository,
    jwtService,
    mfaConfig,
    users,
    verifier,
    connections,
    sessions: new AuthSessionService(repository, jwtService, connections),
  };
}

export const browser = {
  ip: '203.0.113.10',
  ipVerified: true,
  userAgent: 'Mozilla/5.0 (test)',
};
