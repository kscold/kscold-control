import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reserveChunkReload } from '@/shared/lib/chunk-recovery';
import { ErrorFallback } from './ErrorFallback';

describe('화면 파일 재시도 안내', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('한 번 자동 재시도한 화면에서는 다시 자동으로 갱신하지 않는다', () => {
    reserveChunkReload();
    render(
      <ErrorFallback
        error={new TypeError('Importing a module script failed.')}
        resetErrorBoundary={vi.fn()}
      />,
    );
    expect(screen.getByText(/자동 재시도를 멈췄습니다/)).toBeVisible();
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByText(/자동 재시도를 멈췄습니다/)).toBeVisible();
    expect(screen.getByRole('button', { name: '지금 새로고침' })).toBeVisible();
  });

  it('첫 번들 실패만 제한된 카운트다운을 시작하고 화면 해제 시 취소한다', () => {
    const view = render(
      <ErrorFallback
        error={new Error('Unable to preload CSS')}
        resetErrorBoundary={vi.fn()}
      />,
    );
    expect(screen.getByText('3초 후 자동으로 새로고침됩니다.')).toBeVisible();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('2초 후 자동으로 새로고침됩니다.')).toBeVisible();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('일반 네트워크 오류를 새 배포라고 단정하거나 자동 갱신하지 않는다', () => {
    render(
      <ErrorFallback
        error={new TypeError('Failed to fetch')}
        resetErrorBoundary={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('heading', { name: '오류가 발생했습니다' }),
    ).toBeVisible();
    expect(vi.getTimerCount()).toBe(0);
  });
});
