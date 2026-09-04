import { ForbiddenException } from '@nestjs/common';
import { StartImpersonationUseCase } from '@/auth/application/use-cases/start-impersonation.use-case';
import { IMPERSONATION_TTL_SECONDS } from '@/common/constants/impersonation';
import { ROLES } from '@/common/constants/roles';

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
  const actor = {
    id: 'admin-user',
    email: 'admin@example.com',
    roles: [ROLES.ADMIN],
    permissions: [],
  };

  it('최고 관리자에게 대상 권한 그대로인 15분 읽기 전용 토큰을 발급한다', async () => {
    const userRepository = {
      findByIdWithRoles: jest.fn().mockResolvedValue(target),
    };
    const jwtService = { sign: jest.fn().mockReturnValue('preview-token') };
    const useCase = new StartImpersonationUseCase(
      userRepository as any,
      jwtService as any,
    );

    const before = Date.now();
    const result = await useCase.execute(actor, target.id);
    const expiresAt = Date.parse(result.expiresAt);

    expect(result).toMatchObject({
      accessToken: 'preview-token',
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
    expect(jwtService.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: target.id,
        tokenUse: 'qa_impersonation',
        impersonatedBy: { id: actor.id, email: actor.email },
        jti: result.sessionId,
      }),
      { expiresIn: IMPERSONATION_TTL_SECONDS },
    );
  });

  it('일반 사용자의 미리보기 발급 요청을 거부한다', async () => {
    const userRepository = { findByIdWithRoles: jest.fn() };
    const useCase = new StartImpersonationUseCase(
      userRepository as any,
      { sign: jest.fn() } as any,
    );

    await expect(
      useCase.execute({ ...actor, roles: [ROLES.KEY_MANAGER] }, target.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(userRepository.findByIdWithRoles).not.toHaveBeenCalled();
  });

  it('다른 관리자 계정으로의 전환을 거부한다', async () => {
    const userRepository = {
      findByIdWithRoles: jest.fn().mockResolvedValue({
        ...target,
        roles: [{ name: ROLES.SUPER_ADMIN, permissions: [] }],
      }),
    };
    const useCase = new StartImpersonationUseCase(
      userRepository as any,
      { sign: jest.fn() } as any,
    );

    await expect(useCase.execute(actor, target.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
