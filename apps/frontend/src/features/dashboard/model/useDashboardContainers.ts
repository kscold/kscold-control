import { useState, useCallback, useEffect, useRef } from 'react';
import { dashboardService } from '../api/dashboard.service';
import type { DashboardContainerSummary } from './dashboard.types';

export function useDashboardContainers() {
  const [containerSummary, setContainerSummary] =
    useState<DashboardContainerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadContainers = useCallback(async () => {
    try {
      setLoading(true);
      setContainerSummary(await dashboardService.getContainerSummary());
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

  return { containerSummary, loading };
}
