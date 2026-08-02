import { dockerService } from '@/entities/container';
import { useState, useCallback, useEffect, useRef } from 'react';
import type { ContainerInfo } from './dashboard.types';

export function useDashboardContainers() {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadContainers = useCallback(async () => {
    try {
      setLoading(true);
      // 컨테이너 리소스는 entities/container 가 소유하므로 그 서비스를 재사용한다
      setContainers(await dockerService.listContainers());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContainers();

    const startPolling = () => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(() => {
        loadContainers();
      }, 5000);
    };

    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadContainers();
        startPolling();
      } else {
        stopPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadContainers]);

  const runningCount = containers.filter(
    (c) => c.liveStatus === 'running',
  ).length;

  return { containers, runningCount, loading };
}
