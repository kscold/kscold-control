import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from '@/auth/infrastructure/strategies/jwt.strategy';
import { browser, sessionHarness } from '../../auth-session.fake';

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

  async function setup() {
    const harness = sessionHarness();
    const session = await harness.sessions.open(user.id, browser);
    const strategy = new JwtStrategy(
      { get: jest.fn().mockReturnValue('a'.repeat(32)) } as any,
      { validateUser: jest.fn().mockResolvedValue(user) } as any,
      harness.verifier,
    );
    return { ...harness, session, strategy };
  }

  it('살아 있는 세션의 토큰에 세션 id 를 실어 사용자 컨텍스트를 만든다', async () => {
    const { strategy, session } = await setup();

    const result = await strategy.validate({
      sub: user.id,
      email: user.email,
      sid: session.id,
    });

    expect(result).toMatchObject({
      id: user.id,
      permissions: ['dashboard:read'],
      sessionId: session.id,
    });
    expect(result.impersonation).toBeUndefined();
  });

  it('세션 id 가 없는 토큰을 거부한다', async () => {
    const { strategy } = await setup();

    await expect(
      strategy.validate({ sub: user.id, email: user.email }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('로그아웃한 세션의 토큰을 거부한다', async () => {
    const { strategy, sessions, session } = await setup();
    await sessions.revoke(session.id);

    await expect(
      strategy.validate({ sub: user.id, email: user.email, sid: session.id }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('서명된 미리보기 claim을 HTTP 사용자 컨텍스트로 복원한다', async () => {
    const { strategy, session } = await setup();
    const result = await strategy.validate({
      sub: user.id,
      email: user.email,
      sid: session.id,
      tokenUse: 'qa_impersonation',
      impersonatedBy: { id: 'admin-user', email: 'admin@example.com' },
      exp: 2_000_000_000,
    });

    expect(result.permissions).toEqual(['dashboard:read']);
    expect(result.impersonation).toEqual({
      sessionId: session.id,
      actorId: 'admin-user',
      actorEmail: 'admin@example.com',
      expiresAt: new Date(2_000_000_000 * 1000).toISOString(),
      readOnly: true,
    });
  });

  it('필수 claim이 빠진 미리보기 토큰을 거부한다', async () => {
    const { strategy, session } = await setup();

    await expect(
      strategy.validate({
        sub: user.id,
        email: user.email,
        sid: session.id,
        tokenUse: 'qa_impersonation',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
