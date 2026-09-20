import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RefreshTokenUseCase } from '@/auth/application/use-cases/refresh-token.use-case';
import type { User } from '@/rbac/domain/entities/user.entity';

describe('RefreshTokenUseCase', () => {
  let useCase: RefreshTokenUseCase;
  let jwtService: jest.Mocked<JwtService>;

  // 로그인 직후의 사용자 형태 — 역할과 권한이 함께 로딩된 상태
  const user = {
    id: 'user-1',
    email: 'admin@kscold.dev',
    roles: [
      {
        name: 'admin',
        permissions: [
          { name: 'docker:read' },
          { name: 'docker:update' },
          { name: 'docker:read' },
        ],
      },
    ],
  } as unknown as User;

  beforeEach(async () => {
    const mockJwtService: Partial<JwtService> = {
      sign: jest.fn().mockReturnValue('new-access-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenUseCase,
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    useCase = module.get(RefreshTokenUseCase);
    jwtService = module.get(JwtService);
  });

  it('유효한 사용자에게 같은 권한을 담은 새 토큰을 발급한다', () => {
    const result = useCase.execute(user);

    expect(result.accessToken).toBe('new-access-token');
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'admin@kscold.dev',
      roles: ['admin'],
      // 중복 권한은 한 번만 담긴다
      permissions: ['docker:read', 'docker:update'],
    });
  });

  it('발급한 토큰과 같은 내용을 응답 사용자 정보로 돌려준다', () => {
    const result = useCase.execute(user);

    expect(result.user).toEqual({
      id: 'user-1',
      email: 'admin@kscold.dev',
      roles: ['admin'],
      permissions: ['docker:read', 'docker:update'],
    });
  });

  it('역할이 없는 사용자도 빈 권한으로 갱신된다', () => {
    const result = useCase.execute({ id: 'u2', email: 'a@b.c' } as User);

    expect(result.user.roles).toEqual([]);
    expect(result.user.permissions).toEqual([]);
  });

  it('사용자 미리보기(임퍼스네이션) 세션은 갱신을 거부한다', () => {
    // 짧은 수명 자체가 보안 장치이므로 연장 수단을 주면 안 된다
    const impersonated = {
      ...user,
      impersonation: {
        sessionId: 's1',
        actorId: 'admin-1',
        actorEmail: 'admin@kscold.dev',
        expiresAt: new Date().toISOString(),
        readOnly: true as const,
      },
    } as unknown as User;

    expect(() => useCase.execute(impersonated)).toThrow(ForbiddenException);
    expect(jwtService.sign).not.toHaveBeenCalled();
  });
});
