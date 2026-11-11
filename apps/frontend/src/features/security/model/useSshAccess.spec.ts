import { act, renderHook, waitFor } from '@testing-library/react';
import { securityService } from '../api/security.service';
import type { SshAccessOverview } from './security.types';
import { useSshAccess } from './useSshAccess';

function overview(pendingAuth: number): SshAccessOverview {
  return {
    recorder: { logPath: '/example/audit.log', exists: true, updatedAt: null },
    guard: {
      installed: false,
      running: false,
      updatedAt: null,
      pfEnabled: null,
      blockedCount: null,
      allCount: null,
      sshOnlyCount: null,
    },
    summary: {
      since: '',
      total: 0,
      externalSuccess: 0,
      externalFailure: 0,
      unknownExternalSuccessIps: 0,
      ips: [],
      triedUsers: [],
    },
    events: [],
    sessions: [],
    pendingAuth,
    knownIps: [],
    blocks: [],
    countryGuard: {
      enabled: true,
      state: 'on',
      allowedCountries: ['KR'],
      blockedByCountry: [],
    },
  };
}

afterEach(() => vi.restoreAllMocks());

it('기간 변경 시 이전 요청을 취소하고 늦게 온 결과를 무시한다', async () => {
  let finish: ((value: SshAccessOverview) => void) | undefined;
  const get = vi
    .spyOn(securityService, 'getSshAccess')
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(overview(30));
  const { result, rerender, unmount } = renderHook(
    ({ days }) => useSshAccess(days),
    { initialProps: { days: 7 } },
  );
  const signal = get.mock.calls[0][1];
  rerender({ days: 30 });
  expect(signal?.aborted).toBe(true);
  await waitFor(() => expect(result.current.data?.pendingAuth).toBe(30));
  await act(async () => finish?.(overview(7)));
  expect(result.current.data?.pendingAuth).toBe(30);
  unmount();
});

it('화면을 닫으면 진행 중인 요청을 취소한다', () => {
  const get = vi
    .spyOn(securityService, 'getSshAccess')
    .mockImplementation(() => new Promise(() => {}));
  const { unmount } = renderHook(() => useSshAccess(7));
  const signal = get.mock.calls[0][1];
  unmount();
  expect(signal?.aborted).toBe(true);
});

it('실패한 새로고침은 기존 데이터와 오류를 함께 남기고 재시도로 복구한다', async () => {
  const get = vi
    .spyOn(securityService, 'getSshAccess')
    .mockResolvedValue(overview(1));
  const { result } = renderHook(() => useSshAccess(7));
  await waitFor(() => expect(result.current.data?.pendingAuth).toBe(1));
  get.mockRejectedValueOnce(new Error('조회 실패'));
  await act(() => result.current.reload());
  expect(result.current.error).toBe('조회 실패');
  expect(result.current.data?.pendingAuth).toBe(1);
  await act(() => result.current.reload());
  expect(result.current.error).toBeNull();
});
