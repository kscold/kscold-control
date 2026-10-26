import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ token: 'fixture-token' as string | null }));
vi.mock('../model/auth.store', () => ({
  useAuthStore: { getState: () => auth },
}));

describe('브라우저 전역 오류 수집', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    auth.token = 'fixture-token';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    window.history.replaceState(null, '', '/repository');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('로그인 전에는 전송하지 않으며 원문 없는 진단만 전송함', async () => {
    const { reportFrontendError } = await import('./error-reporter');
    auth.token = null;
    reportFrontendError(new Error('fixture-never-send'));
    expect(fetch).not.toHaveBeenCalled();
    auth.token = 'fixture-token';
    reportFrontendError(new Error('fixture-never-send'), {
      kind: 'upload',
      stage: 'finalize',
    });
    const options = vi.mocked(fetch).mock.calls[0][1]!;
    expect(String(options.body)).not.toContain('fixture-never-send');
    expect(JSON.parse(String(options.body))).toMatchObject({
      kind: 'upload',
      stage: 'finalize',
    });
  });

  it('같은 실패를 10초간 합치고 분당 20건 이후에는 중단함', async () => {
    const { reportFrontendError } = await import('./error-reporter');
    for (let i = 0; i < 100; i++)
      reportFrontendError(new Error('different-' + i), {
        kind: 'upload',
        stage: 'batch',
        batchIndex: i,
      });
    expect(fetch).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 30; i++) {
      window.history.replaceState(
        null,
        '',
        ['/', '/keys', '/network', '/docker', '/rbac', '/logs'][i % 6],
      );
      reportFrontendError(undefined, {
        kind: [
          'runtime',
          'render',
          'upload',
          'resource',
          'unhandled-rejection',
        ][Math.floor(i / 6)] as 'runtime',
      });
    }
    expect(fetch).toHaveBeenCalledTimes(20);
    await vi.advanceTimersByTimeAsync(60_000);
    reportFrontendError(undefined);
    expect(fetch).toHaveBeenCalledTimes(21);
  });

  it('전송 실패를 다시 수집하거나 로그아웃하지 않음', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));
    const { reportFrontendError } = await import('./error-reporter');
    reportFrontendError(new Error('broken'));
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(auth.token).toBe('fixture-token');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('동기 fetch 예외가 원래 화면 동작을 중단하지 않음', async () => {
    vi.mocked(fetch).mockImplementation(() => {
      throw new Error('blocked');
    });
    const { reportFrontendError } = await import('./error-reporter');
    expect(() => reportFrontendError(undefined)).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('런타임·비동기·번들 오류를 구독하고 구독 해제 시 중복 수집하지 않음', async () => {
    const { installGlobalErrorReporting } = await import('./error-reporter');
    const remove = installGlobalErrorReporting();
    window.dispatchEvent(
      new ErrorEvent('error', { error: new Error('private') }),
    );
    const rejection = new Event('unhandledrejection');
    Object.defineProperty(rejection, 'reason', { value: 'private' });
    window.dispatchEvent(rejection);
    window.dispatchEvent(new Event('vite:preloadError'));
    expect(fetch).toHaveBeenCalledTimes(3);
    remove();
    await vi.advanceTimersByTimeAsync(60_000);
    window.dispatchEvent(new Event('vite:preloadError'));
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
