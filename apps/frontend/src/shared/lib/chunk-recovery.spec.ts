import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canReloadChunk,
  isChunkLoadError,
  reserveChunkReload,
} from './chunk-recovery';

describe('번들 실패 복구', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    'Failed to fetch dynamically imported module: /assets/fixture.js',
    'Importing a module script failed.',
    'error loading dynamically imported module: /assets/fixture.js',
    'Unable to preload CSS for /assets/fixture.css',
    'Failed to load module script: Invalid MIME type',
  ])('모바일·데스크톱 오류를 같은 원인으로 분류한다: %s', (message) => {
    expect(isChunkLoadError(new TypeError(message))).toBe(true);
  });

  it('일반 API 네트워크 실패는 번들 실패로 간주하지 않는다', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch'))).toBe(false);
    expect(isChunkLoadError(new TypeError('undefined is not an object'))).toBe(
      false,
    );
    expect(isChunkLoadError(undefined)).toBe(false);
  });

  it('재기동 뒤에도 자동 재시도는 1분에 한 번으로 제한한다', () => {
    localStorage.setItem('auth-storage', 'synthetic-login');
    expect(reserveChunkReload(100_000)).toBe(true);
    expect(canReloadChunk(100_001)).toBe(false);
    expect(reserveChunkReload(100_001)).toBe(false);
    expect(reserveChunkReload(160_000)).toBe(true);
    expect(localStorage.getItem('auth-storage')).toBe('synthetic-login');
  });

  it('읽기·쓰기 차단 시 자동 새로고침하지 않는다', () => {
    vi.stubGlobal('sessionStorage', {
      getItem() {
        throw new Error('blocked');
      },
    });
    expect(canReloadChunk()).toBe(false);
    expect(reserveChunkReload()).toBe(false);
    vi.stubGlobal('sessionStorage', {
      getItem: () => null,
      setItem() {
        throw new Error('blocked');
      },
    });
    expect(reserveChunkReload()).toBe(false);
  });
});
