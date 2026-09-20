import axios, { AxiosError, AxiosHeaders } from 'axios';
import { useAuthStore, type AuthUser } from './auth.store';

describe('auth.store impersonation', () => {
  const actor: AuthUser = {
    id: 'admin-user',
    email: 'admin@example.com',
    roles: ['admin'],
    permissions: ['rbac:manage'],
  };
  const target: AuthUser = {
    id: 'target-user',
    email: 'developer@example.com',
    roles: ['key_manager'],
    permissions: ['dashboard:read', 'secrets:read'],
  };

  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      token: 'admin-token',
      user: actor,
      impersonation: null,
      isValidating: false,
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('네트워크 장애에는 세션을 지우지 않는다', async () => {
    vi.spyOn(axios, 'get').mockRejectedValue(new AxiosError('Network Error'));
    await expect(useAuthStore.getState().validateToken()).resolves.toBe(true);
    expect(useAuthStore.getState().token).toBe('admin-token');
    expect(useAuthStore.getState().isValidating).toBe(false);
  });

  it('서버가 인증 만료를 확인하면 로그아웃한다', async () => {
    const config = { headers: new AxiosHeaders() };
    vi.spyOn(axios, 'get').mockRejectedValue(
      new AxiosError('Unauthorized', undefined, config, undefined, {
        status: 401,
        statusText: 'Unauthorized',
        data: {},
        headers: new AxiosHeaders(),
        config,
      }),
    );
    await expect(useAuthStore.getState().validateToken()).resolves.toBe(false);
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('이전 검증 응답이 새 로그인 정보를 지우지 않는다', async () => {
    vi.spyOn(axios, 'get').mockImplementationOnce(async () => {
      useAuthStore.setState({ token: 'new-token', isValidating: false });
      throw new AxiosError('Network Error');
    });
    await expect(useAuthStore.getState().validateToken()).resolves.toBe(true);
    expect(useAuthStore.getState().token).toBe('new-token');
  });

  it('대상 토큰으로 전환하면서 원래 관리자 세션을 보관한다', () => {
    const started = useAuthStore.getState().beginImpersonation({
      accessToken: 'preview-token',
      sessionId: 'preview-session',
      expiresAt: '2099-01-01T00:00:00.000Z',
      readOnly: true,
      user: target,
    });

    const state = useAuthStore.getState();
    expect(started).toBe(true);
    expect(state.token).toBe('preview-token');
    expect(state.user).toEqual(target);
    expect(state.impersonation).toMatchObject({
      actorToken: 'admin-token',
      actorUser: actor,
      readOnly: true,
    });
  });

  it('관리자 화면으로 즉시 복귀한다', () => {
    useAuthStore.getState().beginImpersonation({
      accessToken: 'preview-token',
      sessionId: 'preview-session',
      expiresAt: '2099-01-01T00:00:00.000Z',
      readOnly: true,
      user: target,
    });

    const restored = useAuthStore.getState().endImpersonation();

    expect(restored).toBe(true);
    expect(useAuthStore.getState()).toMatchObject({
      token: 'admin-token',
      user: actor,
      impersonation: null,
    });
  });

  it('만료된 미리보기는 관리자 토큰으로 자동 복귀해 검증한다', async () => {
    useAuthStore.setState({
      token: 'expired-preview-token',
      user: target,
      impersonation: {
        actorToken: 'admin-token',
        actorUser: actor,
        sessionId: 'expired-session',
        expiresAt: '2000-01-01T00:00:00.000Z',
        readOnly: true,
      },
    });
    const getSpy = vi
      .spyOn(axios, 'get')
      .mockResolvedValueOnce({ data: actor });

    await expect(useAuthStore.getState().validateToken()).resolves.toBe(true);

    expect(getSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/me'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer admin-token' },
      }),
    );
    expect(useAuthStore.getState()).toMatchObject({
      token: 'admin-token',
      user: actor,
      impersonation: null,
    });
    getSpy.mockRestore();
  });
});

describe('auth.store 토큰 선제 갱신', () => {
  const user: AuthUser = {
    id: 'admin-user',
    email: 'admin@example.com',
    roles: ['admin'],
    permissions: ['rbac:manage'],
  };

  /** exp 만 담은 최소 형태의 JWT — 서명 검증은 서버 몫이라 여기선 불필요하다 */
  const tokenExpiringIn = (ms: number) => {
    const payload = btoa(
      JSON.stringify({ exp: Math.floor((Date.now() + ms) / 1000) }),
    );
    return `header.${payload}.signature`;
  };

  const HOUR = 60 * 60 * 1000;

  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      token: null,
      user,
      impersonation: null,
      isValidating: false,
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('만료가 임박하면 새 토큰으로 바꾼다', async () => {
    useAuthStore.setState({ token: tokenExpiringIn(2 * HOUR) });
    const post = vi.spyOn(axios, 'post').mockResolvedValue({
      data: { accessToken: 'refreshed-token', user },
    });

    await expect(useAuthStore.getState().ensureFreshToken()).resolves.toBe(
      true,
    );
    expect(post).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().token).toBe('refreshed-token');
  });

  it('수명이 넉넉하면 서버를 부르지 않는다', async () => {
    useAuthStore.setState({ token: tokenExpiringIn(6 * 24 * HOUR) });
    const post = vi.spyOn(axios, 'post');

    await expect(useAuthStore.getState().ensureFreshToken()).resolves.toBe(
      false,
    );
    expect(post).not.toHaveBeenCalled();
  });

  it('갱신에 실패해도 기존 토큰을 유지한다', async () => {
    const original = tokenExpiringIn(2 * HOUR);
    useAuthStore.setState({ token: original });
    vi.spyOn(axios, 'post').mockRejectedValue(new AxiosError('Network Error'));

    await expect(useAuthStore.getState().ensureFreshToken()).resolves.toBe(
      false,
    );
    // 갱신 실패는 로그아웃 사유가 아니다 — 남은 수명 동안 기존 토큰으로 계속 쓴다
    expect(useAuthStore.getState().token).toBe(original);
  });

  it('미리보기 세션은 갱신하지 않는다', async () => {
    useAuthStore.setState({
      token: tokenExpiringIn(2 * HOUR),
      impersonation: {
        actorToken: 'admin-token',
        actorUser: user,
        sessionId: 'session-1',
        expiresAt: new Date(Date.now() + HOUR).toISOString(),
        readOnly: true,
      },
    });
    const post = vi.spyOn(axios, 'post');

    await expect(useAuthStore.getState().ensureFreshToken()).resolves.toBe(
      false,
    );
    expect(post).not.toHaveBeenCalled();
  });

  it('갱신 중 다른 탭에서 로그인하면 그 토큰을 덮어쓰지 않는다', async () => {
    useAuthStore.setState({ token: tokenExpiringIn(2 * HOUR) });
    vi.spyOn(axios, 'post').mockImplementation(async () => {
      useAuthStore.setState({ token: 'token-from-other-tab' });
      return { data: { accessToken: 'refreshed-token', user } };
    });

    await expect(useAuthStore.getState().ensureFreshToken()).resolves.toBe(
      false,
    );
    expect(useAuthStore.getState().token).toBe('token-from-other-tab');
  });

  it('해석할 수 없는 토큰은 갱신을 시도하지 않는다', async () => {
    useAuthStore.setState({ token: 'not-a-jwt' });
    const post = vi.spyOn(axios, 'post');

    await expect(useAuthStore.getState().ensureFreshToken()).resolves.toBe(
      false,
    );
    expect(post).not.toHaveBeenCalled();
  });
});
