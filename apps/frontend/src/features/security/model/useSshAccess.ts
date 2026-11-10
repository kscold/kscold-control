import { useCallback, useEffect, useRef, useState } from 'react';
import { securityService } from '../api/security.service';
import type { SshAccessOverview } from '../model/security.types';

/** 15초마다 새로 읽음 — 차단기도 15초 간격으로 반영 */
const REFRESH_MS = 15_000;

export function useSshAccess(days: number) {
  const [data, setData] = useState<SshAccessOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      setData(await securityService.getSshAccess(days));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  /** 바꾸는 요청을 보낸 뒤 바로 다시 읽음 */
  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      await action();
      await load();
    },
    [load],
  );

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
