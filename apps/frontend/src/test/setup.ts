import '@testing-library/jest-dom/vitest';

/**
 * Node 25 부터 런타임이 Web Storage 를 전역으로 직접 제공한다.
 * 이 전역은 `--localstorage-file` 없이는 동작하지 않으면서 jsdom 이 만든
 * localStorage 를 가려버려, 저장소를 쓰는 테스트가 전부 깨진다.
 * 전역이 실제로 쓸 수 있는지 확인하고, 아니면 메모리 구현으로 바꿔 끼운다.
 */
function installMemoryStorage(key: 'localStorage' | 'sessionStorage') {
  const existing = (globalThis as Record<string, unknown>)[key] as
    | Storage
    | undefined;
  if (typeof existing?.clear === 'function') {
    try {
      existing.setItem('__storage_probe__', '1');
      existing.removeItem('__storage_probe__');
      return;
    } catch {
      // 전역이 있으나 쓸 수 없는 상태 — 아래에서 교체한다.
    }
  }

  const entries = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return entries.size;
    },
    key: (index) => [...entries.keys()][index] ?? null,
    getItem: (name) => entries.get(name) ?? null,
    setItem: (name, value) => void entries.set(name, String(value)),
    removeItem: (name) => void entries.delete(name),
    clear: () => entries.clear(),
  };

  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value: storage,
  });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, key, {
      configurable: true,
      writable: true,
      value: storage,
    });
  }
}

installMemoryStorage('localStorage');
installMemoryStorage('sessionStorage');
