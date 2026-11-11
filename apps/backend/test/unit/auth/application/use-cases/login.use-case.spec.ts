import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { LoginUseCase } from '@/auth/application/use-cases/login.use-case';
import { PasswordHasher } from '@/common/utils/password-hasher.util';
import { browser, sessionHarness } from '../../auth-session.fake';
import { loginGuardHarness } from '../../../security/login-guard.fake';

describe('LoginUseCase', () => {
  const guards: Array<{ cleanup: () => Promise<void> }> = [];
  afterEach(async () => {
    await Promise.all(guards.splice(0).map((g) => g.cleanup()));
  });

  async function setup(password = bcrypt.hash('correct horse', 4)) {
    const harness = sessionHarness();
    const guard = await loginGuardHarness();
    guards.push(guard);
    const user = {
      id: 'user-1',
      email: 'admin@example.com',
      password: await password,
      roles: [{ name: 'admin', permissions: [{ name: 'docker:read' }] }],
    };
    const users = {
      findByEmail: async (email: string) =>
        email === user.email ? user : null,
      findByIdWithRoles: async (id: string) => (id === user.id ? user : null),
    };
    const useCase = new LoginUseCase(
      users as any,
      harness.sessions,
      guard.guard,
    );
    return { ...harness, useCase };
  }

  it('로그인할 때마다 접속 정보를 담은 세션을 새로 열고 토큰을 묶는다', async () => {
    const { useCase, repository, verifier } = await setup();
    const dto = { email: 'admin@example.com', password: 'correct horse' };

    const first = await useCase.execute(dto, { ...browser, ipVerified: true });
    const second = await useCase.execute(dto, {
      ip: '198.51.100.7',
      ipVerified: true,
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
        { ...browser, ipVerified: true },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repository.rows.size).toBe(0);
  });

  it('없는 계정도 있는 계정만큼 비밀번호 비교에 시간을 쓴다', async () => {
    const { useCase } = await setup(PasswordHasher.hash('correct horse'));
    const elapsed = async (email: string, ip: string) => {
      const started = process.hrtime.bigint();
      await useCase
        .execute(
          { email, password: 'wrong' },
          { ip, ipVerified: true, userAgent: null },
        )
        .catch(() => undefined);
      return Number(process.hrtime.bigint() - started) / 1e6;
    };
    const median = (values: number[]) =>
      [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

    const known: number[] = [];
    const unknown: number[] = [];
    for (let i = 0; i < 4; i++) {
      known.push(await elapsed('admin@example.com', `198.51.100.${i + 1}`));
      unknown.push(await elapsed(`nobody${i}@example.com`, `192.0.2.${i + 1}`));
    }

    expect(median(unknown)).toBeGreaterThan(median(known) * 0.5);
    // 운영과 같은 cost 10 비교를 여덟 번 하므로 테스트를 함께 돌리는 부하에서는 기본 5초를 넘길 수 있다.
  }, 30_000);
});
