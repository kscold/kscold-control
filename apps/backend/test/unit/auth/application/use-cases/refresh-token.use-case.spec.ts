import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { RefreshTokenUseCase } from '@/auth/application/use-cases/refresh-token.use-case';
import type { User } from '@/rbac/domain/entities/user.entity';
import { browser, sessionHarness } from '../../auth-session.fake';

const DAY = 24 * 60 * 60 * 1000;

describe('RefreshTokenUseCase', () => {
  // 로그인 직후의 사용자 형태 — 역할과 권한이 함께 로딩된 상태
  const user = {
    id: 'user-1',
    email: 'admin@example.com',
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

  async function setup() {
    const harness = sessionHarness();
    const session = await harness.sessions.open(user.id, browser);
    const useCase = new RefreshTokenUseCase(harness.sessions);
    return { ...harness, session, useCase };
  }

  afterEach(() => jest.useRealTimers());

  it('같은 세션에 묶인 새 토큰을 같은 권한으로 발급한다', async () => {
    const { useCase, session, jwtService } = await setup();

    const result = await useCase.execute({ ...user, sessionId: session.id });

    expect(jwtService.verify(result.accessToken)).toMatchObject({
      sub: 'user-1',
      email: 'admin@example.com',
      roles: ['admin'],
      // 중복 권한은 한 번만 담긴다
      permissions: ['docker:read', 'docker:update'],
      sid: session.id,
    });
    expect(result.user).toEqual({
      id: 'user-1',
      email: 'admin@example.com',
      roles: ['admin'],
      permissions: ['docker:read', 'docker:update'],
    });
  });

  it('연속 갱신해도 세션은 하나이고 절대 만료는 늘지 않는다', async () => {
    jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00.000Z') });
    const { useCase, session, repository, jwtService } = await setup();

    jest.advanceTimersByTime(DAY);
    const first = await useCase.execute({ ...user, sessionId: session.id });
    jest.advanceTimersByTime(DAY);
    const second = await useCase.execute({ ...user, sessionId: session.id });

    const firstClaims = jwtService.verify(first.accessToken);
    const secondClaims = jwtService.verify(second.accessToken);
    expect(firstClaims.sid).toBe(session.id);
    expect(secondClaims.sid).toBe(session.id);
    expect(secondClaims.exp).toBeGreaterThan(firstClaims.exp);
    expect(repository.rows.size).toBe(1);
    expect(repository.rows.get(session.id)?.absoluteExpiresAt).toEqual(
      session.absoluteExpiresAt,
    );
  });

  it('끊긴 세션은 갱신하지 않는다', async () => {
    const { useCase, session, sessions } = await setup();
    await sessions.revoke(session.id);

    await expect(
      useCase.execute({ ...user, sessionId: session.id }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('사용자 미리보기(임퍼스네이션) 세션은 갱신을 거부한다', async () => {
    const { useCase, session, repository } = await setup();
    // 짧은 수명 자체가 보안 장치이므로 연장 수단을 주면 안 된다
    const impersonated = {
      ...user,
      sessionId: session.id,
      impersonation: {
        sessionId: session.id,
        actorId: 'admin-1',
        actorEmail: 'admin@example.com',
        expiresAt: new Date().toISOString(),
        readOnly: true as const,
      },
    };

    await expect(useCase.execute(impersonated)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repository.writes).toBe(0);
  });
});
