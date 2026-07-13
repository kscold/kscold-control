import { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '@/shared/api/client';
import type { ContainerInfo } from '../lib/dashboard.types';

export function useDashboardContainers() {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadContainers = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get<ContainerInfo[]>('/docker/containers');
      setContainers(data);
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
