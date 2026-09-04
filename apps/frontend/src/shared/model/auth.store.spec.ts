import axios from 'axios';
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
