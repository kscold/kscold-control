import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { LoginUseCase } from '@/auth/application/use-cases/login.use-case';
import { browser, sessionHarness } from '../../auth-session.fake';

describe('LoginUseCase', () => {
  async function setup() {
    const harness = sessionHarness();
    const user = {
      id: 'user-1',
      email: 'admin@example.com',
      password: await bcrypt.hash('correct horse', 4),
      roles: [{ name: 'admin', permissions: [{ name: 'docker:read' }] }],
    };
    const users = { findByEmailWithRoles: jest.fn().mockResolvedValue(user) };
    const useCase = new LoginUseCase(users as any, harness.sessions);
    return { ...harness, useCase };
  }

  it('로그인할 때마다 접속 정보를 담은 세션을 새로 열고 토큰을 묶는다', async () => {
    const { useCase, repository, verifier } = await setup();
    const dto = { email: 'admin@example.com', password: 'correct horse' };

    const first = await useCase.execute(dto, browser);
    const second = await useCase.execute(dto, {
      ip: '198.51.100.7',
      userAgent: null,
    });

    const firstClaims = await verifier.verifyToken(first.accessToken);
    const secondClaims = await verifier.verifyToken(second.accessToken);
    expect(firstClaims.sid).not.toBe(secondClaims.sid);
    expect(repository.rows.get(firstClaims.sid as string)).toMatchObject({
      userId: 'user-1',
      ip: browser.ip,
      userAgent: browser.userAgent,
      assurance: 'password',
      parentSessionId: null,
      revokedAt: null,
    });
    expect(repository.rows.get(secondClaims.sid as string)).toMatchObject({
      ip: '198.51.100.7',
      userAgent: null,
    });
  });

  it('비밀번호가 틀리면 세션을 만들지 않는다', async () => {
    const { useCase, repository } = await setup();

    await expect(
      useCase.execute(
        { email: 'admin@example.com', password: 'wrong' },
        browser,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repository.rows.size).toBe(0);
  });
});
