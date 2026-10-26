import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useNetworkQuery } from './useNetworkQuery';

describe('네트워크 조회 경쟁 처리', () => {
  afterEach(cleanup);
  it('먼저 시작한 느린 응답이 재조회 결과를 덮어쓰지 않음', async () => {
    let finishOld!: (value: string) => void;
    const loader = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            finishOld = resolve;
          }),
      )
      .mockResolvedValueOnce('new');
    const { result } = renderHook(() => useNetworkQuery(loader, ''));
    await act(async () => {
      await result.current.reload();
    });
    expect(result.current.data).toBe('new');
    await act(async () => {
      finishOld('old');
    });
    expect(result.current.data).toBe('new');
    expect(result.current.loading).toBe(false);
  });
});
