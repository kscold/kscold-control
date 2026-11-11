import { AssignRolesUseCase } from '@/rbac/application/use-cases/assign-roles.use-case';
import { browser, sessionHarness } from '../../../auth/auth-session.fake';

describe('AssignRolesUseCase', () => {
  const operator = { id: 'role-operator', name: 'operator', permissions: [] };
  const readOnly = { id: 'role-read-only', name: 'read_only', permissions: [] };
  const admin = { id: 'role-admin', name: 'admin', permissions: [] };

  async function setup() {
    const harness = sessionHarness({ mfaRequiredRoles: ['admin'] });
    const user = {
      id: 'user-1',
      email: 'operator@example.com',
      roles: [operator],
      terminalCommandLimit: -1,
      terminalCommandCount: 0,
    };
    const roles = new Map([operator, readOnly, admin].map((r) => [r.id, r]));
    const useCase = new AssignRolesUseCase(
      {
        findByIdWithRoles: jest.fn().mockResolvedValue(user),
        save: jest.fn(async (value) => value),
      } as any,
      {
        findByIds: jest.fn(async (ids: string[]) =>
          ids.map((id) => roles.get(id)),
        ),
      } as any,
      harness.sessions,
      harness.mfaConfig,
    );
    const session = await harness.sessions.open(user.id, browser);
    return { ...harness, useCase, user, session };
  }

  it('2단계 인증이 필요한 역할을 새로 받으면 비밀번호로 연 세션을 끊는다', async () => {
    const { useCase, user, session, repository } = await setup();

    await useCase.execute({ userId: user.id, roleIds: [admin.id] });

    expect(repository.rows.get(session.id)?.revokedAt).not.toBeNull();
  });

  it('2단계 인증과 무관한 역할 변경은 세션을 그대로 둔다', async () => {
    const { useCase, user, session, repository } = await setup();

    await useCase.execute({
      userId: user.id,
      roleIds: [operator.id, readOnly.id],
    });

    expect(repository.rows.get(session.id)?.revokedAt).toBeNull();
  });
});
