import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { LoginResult } from '@/auth/application/dto/login-result';
import { LoginUseCase } from '@/auth/application/use-cases/login.use-case';
import { PasswordHasher } from '@/common/utils/password-hasher.util';
import { browser } from '../../auth-session.fake';
import { closeMfaHarnesses, mfaHarness } from '../../mfa.fake';

describe('LoginUseCase', () => {
  afterEach(closeMfaHarnesses);

  async function setup({
    role = 'operator',
    password = bcrypt.hash('correct horse', 4),
  }: { role?: string; password?: Promise<string> } = {}) {
    const harness = await mfaHarness();
    const user = harness.addUser({
      id: 'user-1',
      email: 'admin@example.com',
      password: await password,
      roles: [{ name: role, permissions: [{ name: 'docker:read' }] }],
    });
    const users = {
      findByEmail: async (email: string) =>
        email === user.email ? user : null,
      findByIdWithRoles: async (id: string) => (id === user.id ? user : null),
    };
    const useCase = new LoginUseCase(
      users as any,
      harness.sessions,
      harness.loginGuard.guard,
      harness.mfa,
    );
    return { ...harness, useCase };
  }

  async function authenticated(result: Promise<LoginResult>) {
    const login = await result;
    if (login.kind !== 'authenticated') throw new Error(login.kind);
    return login;
  }

  it('로그인할 때마다 접속 정보를 담은 세션을 새로 열고 토큰을 묶는다', async () => {
    const { useCase, repository, verifier } = await setup();
    const dto = { email: 'admin@example.com', password: 'correct horse' };

    const first = await authenticated(
      useCase.execute(dto, { ...browser, ipVerified: true }),
    );
    const second = await authenticated(
      useCase.execute(dto, {
        ip: '198.51.100.7',
        ipVerified: true,
        userAgent: null,
      }),
    );

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

  it('2단계 인증이 필요한 계정은 비밀번호만으로 세션을 받지 못한다', async () => {
    const { useCase, repository } = await setup({ role: 'admin' });

    const result = await useCase.execute(
      { email: 'admin@example.com', password: 'correct horse' },
      { ...browser, ipVerified: true },
    );

    expect(result).toMatchObject({
      kind: 'mfa_enrollment_required',
      challenge: { token: expect.any(String), expiresAt: expect.any(String) },
    });
    expect(result).not.toHaveProperty('accessToken');
    expect(repository.rows.size).toBe(0);
  });

  it('없는 계정도 있는 계정만큼 비밀번호 비교에 시간을 쓴다', async () => {
    const { useCase } = await setup({
      password: PasswordHasher.hash('correct horse'),
    });
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
