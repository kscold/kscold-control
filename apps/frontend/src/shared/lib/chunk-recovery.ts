const RELOAD_KEY = 'control:chunk-reload';
const RELOAD_INTERVAL = 60_000;

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : '';
  return /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|unable to preload css|failed to load module script|(?:javascript|module).*mime type|mime type.*(?:javascript|module)/i.test(
    message,
  );
}

export function canReloadChunk(now = Date.now()): boolean {
  try {
    const previous = sessionStorage.getItem(RELOAD_KEY);
    return (
      previous === null ||
      (Number.isFinite(Number(previous)) &&
        now - Number(previous) >= RELOAD_INTERVAL)
    );
  } catch {
    // 저장소가 차단된 환경에서는 새로고침 루프 대신 수동 재시도를 제공한다.
    return false;
  }
}

export function reserveChunkReload(now = Date.now()): boolean {
  if (!canReloadChunk(now)) return false;
  try {
    sessionStorage.setItem(RELOAD_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}
