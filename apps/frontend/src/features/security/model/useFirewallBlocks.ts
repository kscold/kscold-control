import { useCallback, useEffect, useState } from 'react';
import { securityService } from '../api/security.service';
import type { SshBlockScope, SshFirewallBlocks } from '../model/security.types';

const REFRESH_MS = 15_000;

/** 맥미니 방화벽 차단 목록 — 웹 IP 차단 탭에서 SSH 접속 탭과 같은 목록을 씀 */
export function useFirewallBlocks() {
  const [data, setData] = useState<SshFirewallBlocks | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await securityService.getFirewallBlocks());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  return {
    data,
    error,
    reload: load,
    setScope: async (ip: string, scope: SshBlockScope) => {
      await securityService.setSshBlockScope(ip, scope);
      await load();
    },
    unblock: async (ip: string) => {
      await securityService.unblockSshIp(ip);
      await load();
    },
  };
}
