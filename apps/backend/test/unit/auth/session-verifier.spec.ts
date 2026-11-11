import { UnauthorizedException } from '@nestjs/common';
import { browser, sessionHarness } from './auth-session.fake';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const LOGIN_AT = new Date('2026-01-01T00:00:00.000Z');

describe('SessionVerifier', () => {
  beforeEach(() => jest.useFakeTimers({ now: LOGIN_AT }));
  afterEach(() => jest.useRealTimers());

  async function login() {
    const harness = sessionHarness();
    const session = await harness.sessions.open('user-1', browser);
    const token = harness.sessions.signAccessToken(
      {
        sub: 'user-1',
        email: 'admin@example.com',
        roles: ['admin'],
        permissions: [],
      },
      session,
    );
    return { ...harness, session, token };
  }

  function at(offsetMs: number) {
    jest.setSystemTime(LOGIN_AT.getTime() + offsetMs);
  }

  it('살아 있는 세션의 토큰을 받아들이고 세션을 돌려준다', async () => {
    const { verifier, session, token } = await login();

    const claims = await verifier.verifyToken(token);

    expect(claims).toMatchObject({ sub: 'user-1', sid: session.id });
    await expect(verifier.verifyClaims(claims)).resolves.toMatchObject({
      id: session.id,
      userId: 'user-1',
      ip: browser.ip,
      userAgent: browser.userAgent,
      assurance: 'password',
    });
  });

  it('세션 id 가 없는 예전 토큰을 거절한다', async () => {
    const { verifier, jwtService } = await login();
    const legacy = jwtService.sign(
      { sub: 'user-1', email: 'admin@example.com' },
      { expiresIn: '7d' },
    );

    await expect(verifier.verifyToken(legacy)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('다른 사용자의 세션을 가리키는 claim 을 거절한다', async () => {
    const { verifier, session } = await login();

    await expect(
      verifier.verifyClaims({ sub: 'user-2', sid: session.id }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('서명이 맞지 않는 토큰을 거절한다', async () => {
    const { verifier, token } = await login();

    await expect(
      verifier.verifyToken(`${token.slice(0, -2)}xx`),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('끊긴 세션의 토큰은 서명이 맞아도 거절한다', async () => {
    const { verifier, sessions, session, token } = await login();

    await sessions.revoke(session.id);

    await expect(verifier.verifyToken(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('관리자 세션을 끊으면 그 세션이 연 미리보기 세션도 끊긴다', async () => {
    const { verifier, sessions, session } = await login();
    const preview = await sessions.open('user-2', browser, {
      parentSessionId: session.id,
      absoluteTtlMs: 15 * MINUTE,
    });
    const other = await sessions.open('user-1', browser);

    await sessions.revoke(session.id);

    await expect(
      verifier.verifyClaims({ sub: 'user-2', sid: preview.id }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      verifier.verifyClaims({ sub: 'user-1', sid: other.id }),
    ).resolves.toMatchObject({ id: other.id });
  });

  it('미리보기 세션을 끊어도 관리자 세션은 남는다', async () => {
    const { verifier, sessions, session } = await login();
    const preview = await sessions.open('user-2', browser, {
      parentSessionId: session.id,
      absoluteTtlMs: 15 * MINUTE,
    });

    await sessions.revoke(preview.id);

    await expect(
      verifier.verifyClaims({ sub: 'user-1', sid: session.id }),
    ).resolves.toMatchObject({ id: session.id });
  });

  it('갱신 없이 유휴 7일이 지나면 거절한다', async () => {
    const { verifier, session } = await login();

    at(7 * DAY - MINUTE);
    await expect(
      verifier.verifyClaims({ sub: 'user-1', sid: session.id }),
    ).resolves.toMatchObject({ id: session.id });

    at(7 * DAY);
    await expect(
      verifier.verifyClaims({ sub: 'user-1', sid: session.id }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('갱신은 같은 세션의 유휴 만료를 늘리고 절대 만료는 그대로 둔다', async () => {
    const { verifier, sessions, session } = await login();

    at(6 * DAY);
    const extended = await sessions.extend(session.id);

    expect(extended.id).toBe(session.id);
    expect(extended.expiresAt).toEqual(new Date(LOGIN_AT.getTime() + 13 * DAY));
    expect(extended.absoluteExpiresAt).toEqual(session.absoluteExpiresAt);
    at(8 * DAY);
    await expect(
      verifier.verifyClaims({ sub: 'user-1', sid: session.id }),
    ).resolves.toMatchObject({ id: session.id });
  });

  it('갱신을 반복해도 로그인 30일 뒤에는 거절한다', async () => {
    const { verifier, sessions, session } = await login();

    for (let day = 6; day < 30; day += 6) {
      at(day * DAY);
      await sessions.extend(session.id);
    }
    at(30 * DAY - MINUTE);
    const last = await sessions.extend(session.id);
    expect(last.expiresAt).toEqual(new Date(LOGIN_AT.getTime() + 30 * DAY));

    at(30 * DAY);
    await expect(
      verifier.verifyClaims({ sub: 'user-1', sid: session.id }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(sessions.extend(session.id)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('끊긴 세션은 갱신할 수 없다', async () => {
    const { sessions, session } = await login();

    await sessions.revoke(session.id);

    await expect(sessions.extend(session.id)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('토큰 만료는 세션의 유휴 만료를 넘지 않는다', async () => {
    const { jwtService, token, session } = await login();

    const { exp } = jwtService.decode<{ exp: number }>(token);

    expect(exp * 1000).toBeLessThanOrEqual(session.expiresAt.getTime());
    expect(exp * 1000).toBeGreaterThan(session.expiresAt.getTime() - 1000);
  });

  it('마지막 사용 시각은 1분에 한 번만 기록한다', async () => {
    const { verifier, repository, session } = await login();
    const claims = { sub: 'user-1', sid: session.id };

    at(MINUTE);
    await verifier.verifyClaims(claims);
    at(MINUTE + 30 * 1000);
    await verifier.verifyClaims(claims);
    await verifier.verifyClaims(claims);

    expect(repository.writes).toBe(1);
    expect(repository.rows.get(session.id)?.lastSeenAt).toEqual(
      new Date(LOGIN_AT.getTime() + MINUTE),
    );

    at(2 * MINUTE);
    await verifier.verifyClaims(claims);
    expect(repository.rows.get(session.id)?.lastSeenAt).toEqual(
      new Date(LOGIN_AT.getTime() + 2 * MINUTE),
    );
  });
});
