import { useCallback, useEffect, useRef, useState } from 'react';
import { securityService } from '../api/security.service';
import type { SshAccessOverview } from '../model/security.types';

/** 화면이 보이는 동안만 15초마다 조회함. */
const REFRESH_MS = 15_000;

export function useSshAccess(days: number) {
  const [data, setData] = useState<SshAccessOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    pending.current?.abort();
    const request = new AbortController();
    pending.current = request;
    setLoading(true);
    try {
      const overview = await securityService.getSshAccess(days, request.signal);
      if (request.signal.aborted) return;
      setData(overview);
      setError(null);
    } catch (e) {
      if (request.signal.aborted) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (pending.current === request) {
        pending.current = null;
        setLoading(false);
      }
    }
  }, [days]);
  const refresh = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    refresh.current = load;
    setData(null);
    setError(null);
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !pending.current)
        void load();
    }, REFRESH_MS);
    return () => {
      refresh.current = null;
      window.clearInterval(timer);
      pending.current?.abort();
      pending.current = null;
    };
  }, [load]);

  /** 바꾸는 요청을 보낸 뒤 바로 다시 읽음 */
  const run = useCallback(async (action: () => Promise<unknown>) => {
    await action();
    await refresh.current?.();
  }, []);

  return {
    data,
    loading,
    error,
    reload: load,
    terminate: (pid: number) =>
      run(() => securityService.terminateSshSession(pid)),
    block: (ip: string, reason?: string) =>
      run(() => securityService.blockSshIp(ip, reason)),
    unblock: (ip: string) => run(() => securityService.unblockSshIp(ip)),
    addKnown: (ip: string) => run(() => securityService.addSshKnownIp(ip)),
    removeKnown: (ip: string) =>
      run(() => securityService.removeSshKnownIp(ip)),
  };
}
