import { ForbiddenException } from '@nestjs/common';
import { StartImpersonationUseCase } from '@/auth/application/use-cases/start-impersonation.use-case';
import { IMPERSONATION_TTL_SECONDS } from '@/common/constants/impersonation';
import { ROLES } from '@/common/constants/roles';
import { browser, sessionHarness } from '../../auth-session.fake';

describe('StartImpersonationUseCase', () => {
  const target = {
    id: 'target-user',
    email: 'developer@example.com',
    roles: [
      {
        id: 'key-manager-role',
        name: ROLES.KEY_MANAGER,
        permissions: [
          { id: 'dashboard', name: 'dashboard:read' },
          { id: 'secrets', name: 'secrets:read' },
        ],
      },
    ],
  };

  async function setup(found: unknown = target) {
    const harness = sessionHarness();
    const adminSession = await harness.sessions.open('admin-user', browser);
    const actor = {
      id: 'admin-user',
      email: 'admin@example.com',
      roles: [ROLES.ADMIN],
      permissions: [],
      sessionId: adminSession.id,
    };
    const userRepository = {
      findByIdWithRoles: jest.fn().mockResolvedValue(found),
    };
    const useCase = new StartImpersonationUseCase(
      userRepository as any,
      harness.sessions,
    );
    return { ...harness, actor, adminSession, userRepository, useCase };
  }

  it('최고 관리자에게 대상 권한 그대로인 15분 읽기 전용 토큰을 발급한다', async () => {
    const { useCase, actor, jwtService } = await setup();

    const before = Date.now();
    const result = await useCase.execute(actor, target.id, browser);
    const expiresAt = Date.parse(result.expiresAt);

    expect(result).toMatchObject({
      readOnly: true,
      user: {
        id: target.id,
        roles: [ROLES.KEY_MANAGER],
        permissions: ['dashboard:read', 'secrets:read'],
      },
    });
    expect(expiresAt).toBeGreaterThanOrEqual(
      before + IMPERSONATION_TTL_SECONDS * 1000,
    );
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 901_000);
    expect(jwtService.verify(result.accessToken)).toMatchObject({
      sub: target.id,
      sid: result.sessionId,
      tokenUse: 'qa_impersonation',
      impersonatedBy: { id: actor.id, email: actor.email },
    });
  });

  it('미리보기를 관리자 세션 아래의 별도 세션으로 기록한다', async () => {
    const { useCase, actor, adminSession, repository, verifier } =
      await setup();

    const result = await useCase.execute(actor, target.id, browser);

    expect(result.sessionId).not.toBe(adminSession.id);
    expect(repository.rows.get(result.sessionId)).toMatchObject({
      userId: target.id,
      parentSessionId: adminSession.id,
      absoluteExpiresAt: new Date(result.expiresAt),
    });
    await expect(
      verifier.verifyToken(result.accessToken),
    ).resolves.toMatchObject({ sid: result.sessionId });
  });

  it('일반 사용자의 미리보기 발급 요청을 거부한다', async () => {
    const { useCase, actor, userRepository, repository } = await setup();

    await expect(
      useCase.execute(
        { ...actor, roles: [ROLES.KEY_MANAGER] },
        target.id,
        browser,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(userRepository.findByIdWithRoles).not.toHaveBeenCalled();
    expect(repository.rows.size).toBe(1);
  });

  it('다른 관리자 계정으로의 전환을 거부한다', async () => {
    const { useCase, actor, repository } = await setup({
      ...target,
      roles: [{ name: ROLES.SUPER_ADMIN, permissions: [] }],
    });

    await expect(
      useCase.execute(actor, target.id, browser),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.rows.size).toBe(1);
  });
});
