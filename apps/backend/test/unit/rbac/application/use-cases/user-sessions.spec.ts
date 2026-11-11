import {
  NotFoundException,
  type CallHandler,
  type ExecutionContext,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';
import type { AuditLogService } from '@/audit/application/services/audit-log.service';
import { AuditInterceptor } from '@/common/interceptors/audit.interceptor';
import { AUDIT_KEY, type AuditMeta } from '@/common/decorators';
import { PERMISSIONS } from '@/common/constants/permissions';
import type { User } from '@/rbac/domain/entities/user.entity';
import type { IUserRepository } from '@/rbac/domain/repositories/user.repository.interface';
import {
  RevokeUserSessionsUseCase,
  UpdateUserUseCase,
} from '@/rbac/application/use-cases';
import { RbacController } from '@/rbac/presentation/controllers/rbac.controller';
import { browser, sessionHarness } from '../../../auth/auth-session.fake';

function userRepository(...users: Array<Pick<User, 'id' | 'email'>>) {
  const rows = new Map(
    users.map((user) => [user.id, { ...user, password: 'old-hash' } as User]),
  );
  return {
    findById: async (id: string) => {
      const row = rows.get(id);
      return row ? { ...row } : null;
    },
    findByEmail: async (email: string) =>
      [...rows.values()].find((user) => user.email === email) ?? null,
    save: async (user: User) => {
      rows.set(user.id, user);
      return user;
    },
  } as unknown as IUserRepository;
}

describe('사용자 세션 끊기', () => {
  async function setup() {
    const harness = sessionHarness();
    const users = userRepository(
      { id: 'admin-1', email: 'admin@example.com' },
      { id: 'user-1', email: 'user@example.com' },
    );
    const open = (userId: string) => harness.sessions.open(userId, browser);
    return {
      ...harness,
      users,
      open,
      update: new UpdateUserUseCase(users, harness.sessions),
      revokeAll: new RevokeUserSessionsUseCase(users, harness.sessions),
      alive: (sessionId: string) => harness.verifier.isActive(sessionId),
    };
  }

  it('관리자가 비밀번호를 바꾸면 그 사용자의 세션이 모두 끊긴다', async () => {
    const { update, open, alive } = await setup();
    const admin = await open('admin-1');
    const victimLaptop = await open('user-1');
    const attacker = await open('user-1');

    await update.execute(
      'user-1',
      { password: 'new-password-123' },
      { id: 'admin-1', sessionId: admin.id },
    );

    await expect(alive(victimLaptop.id)).resolves.toBe(false);
    await expect(alive(attacker.id)).resolves.toBe(false);
    await expect(alive(admin.id)).resolves.toBe(true);
  });

  it('본인이 비밀번호를 바꾸면 지금 쓰는 세션만 남는다', async () => {
    const { update, open, alive } = await setup();
    const current = await open('user-1');
    const stolen = await open('user-1');

    await update.execute(
      'user-1',
      { password: 'new-password-123' },
      { id: 'user-1', sessionId: current.id },
    );

    await expect(alive(current.id)).resolves.toBe(true);
    await expect(alive(stolen.id)).resolves.toBe(false);
  });

  it('세션을 끊지 못하면 비밀번호도 바뀌지 않는다', async () => {
    const { update, open, alive, sessions, users } = await setup();
    const admin = await open('admin-1');
    const attacker = await open('user-1');
    jest
      .spyOn(sessions, 'revokeAllForUser')
      .mockRejectedValueOnce(new Error('connection refused'));

    await expect(
      update.execute(
        'user-1',
        { password: 'new-password-123' },
        { id: 'admin-1', sessionId: admin.id },
      ),
    ).rejects.toThrow('connection refused');

    expect((await users.findById('user-1'))?.password).toBe('old-hash');
    await expect(alive(attacker.id)).resolves.toBe(true);
  });

  it('비밀번호를 바꾸지 않은 수정은 세션을 끊지 않는다', async () => {
    const { update, open, alive } = await setup();
    const admin = await open('admin-1');
    const session = await open('user-1');

    await update.execute(
      'user-1',
      { email: 'renamed@example.com' },
      { id: 'admin-1', sessionId: admin.id },
    );

    await expect(alive(session.id)).resolves.toBe(true);
  });

  it('관리자가 사용자 세션을 모두 끊고 끊은 개수를 돌려받는다', async () => {
    const { revokeAll, open, alive } = await setup();
    const admin = await open('admin-1');
    const first = await open('user-1');
    const second = await open('user-1');

    await expect(
      revokeAll.execute('user-1', { id: 'admin-1', sessionId: admin.id }),
    ).resolves.toEqual({ revoked: 2 });
    await expect(alive(first.id)).resolves.toBe(false);
    await expect(alive(second.id)).resolves.toBe(false);
    await expect(alive(admin.id)).resolves.toBe(true);
  });

  it('없는 사용자의 세션을 끊으려 하면 404', async () => {
    const { revokeAll, open } = await setup();
    const admin = await open('admin-1');

    await expect(
      revokeAll.execute('missing-user', { id: 'admin-1', sessionId: admin.id }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('세션 끊기 엔드포인트는 RBAC 관리 권한을 요구하고 감사 기록을 남긴다', () => {
    const handler = RbacController.prototype.revokeUserSessions;

    expect(Reflect.getMetadata('permissions', handler)).toEqual([
      PERMISSIONS.RBAC_MANAGE,
    ]);
    expect(Reflect.getMetadata(AUDIT_KEY, handler) as AuditMeta).toMatchObject({
      domain: 'rbac',
      action: 'user.sessions.revoke',
    });
  });

  it('세션 끊기 감사 기록의 대상은 끊긴 사용자의 id 다', async () => {
    const record = jest.fn().mockResolvedValue(undefined);
    const meta = Reflect.getMetadata(
      AUDIT_KEY,
      RbacController.prototype.revokeUserSessions,
    ) as AuditMeta;
    const interceptor = new AuditInterceptor(
      { get: () => meta } as unknown as Reflector,
      { record } as unknown as AuditLogService,
    );
    const request = {
      user: { id: 'admin-1', email: 'admin@example.com' },
      params: { id: 'user-1' },
      body: {},
      query: {},
    };
    const context = {
      getHandler: () => RbacController.prototype.revokeUserSessions,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await lastValueFrom(
      interceptor.intercept(context, {
        handle: () => of({ revoked: 2 }),
      } as CallHandler),
    );

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ targetType: 'user', targetId: 'user-1' }),
    );
  });
});
