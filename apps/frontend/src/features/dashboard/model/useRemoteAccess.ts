import { useCallback, useEffect, useState } from 'react';
import { dashboardService } from '../api/dashboard.service';
import type { RemoteAccessPath } from './dashboard.types';

/** 1분마다, 그리고 화면으로 돌아올 때 다시 확인한다 */
export function useRemoteAccess() {
  const [paths, setPaths] = useState<RemoteAccessPath[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setPaths(await dashboardService.getRemoteAccess());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  return { paths, error };
}
