import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from '@/auth/infrastructure/strategies/jwt.strategy';

describe('JwtStrategy', () => {
  const user = {
    id: 'target-user',
    email: 'target@example.com',
    roles: [
      {
        name: 'key_manager',
        permissions: [{ name: 'dashboard:read' }],
      },
    ],
  };

  function createStrategy() {
    return new JwtStrategy(
      { get: jest.fn().mockReturnValue('a'.repeat(32)) } as any,
      { validateUser: jest.fn().mockResolvedValue(user) } as any,
    );
  }

  it('서명된 미리보기 claim을 HTTP 사용자 컨텍스트로 복원한다', async () => {
    const strategy = createStrategy();
    const result = await strategy.validate({
      sub: user.id,
      email: user.email,
      tokenUse: 'qa_impersonation',
      impersonatedBy: { id: 'admin-user', email: 'admin@example.com' },
      jti: 'preview-session',
      exp: 2_000_000_000,
    });

    expect(result.permissions).toEqual(['dashboard:read']);
    expect(result.impersonation).toEqual({
      sessionId: 'preview-session',
      actorId: 'admin-user',
      actorEmail: 'admin@example.com',
      expiresAt: new Date(2_000_000_000 * 1000).toISOString(),
      readOnly: true,
    });
  });

  it('필수 claim이 빠진 미리보기 토큰을 거부한다', async () => {
    const strategy = createStrategy();

    await expect(
      strategy.validate({
        sub: user.id,
        email: user.email,
        tokenUse: 'qa_impersonation',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
