import { useCallback, useEffect, useState } from 'react';
import { uptimeService } from '../api/uptime.service';
import type { ServiceMonitor } from './uptime.types';

/** 30초마다, 화면으로 돌아올 때 다시 불러온다 */
export function useServiceMonitors() {
  const [monitors, setMonitors] = useState<ServiceMonitor[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setMonitors(await uptimeService.list());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오지 못했습니다.');
    }
  }, []);

  useEffect(() => {
    void reload();
    const timer = setInterval(() => void reload(), 30_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reload]);

  return { monitors, error, reload };
}
