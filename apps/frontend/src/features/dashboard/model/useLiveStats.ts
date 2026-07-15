import { useState, useCallback, useEffect, useRef } from 'react';
import { dashboardService } from '../api/dashboard.service';
import type { LiveStats } from './dashboard.types';

export function useLiveStats() {
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadLiveStats = useCallback(async () => {
    try {
      setLoading(true);
      setLiveStats(await dashboardService.getLiveStats());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLiveStats();

    const startPolling = () => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(() => {
        loadLiveStats();
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
        loadLiveStats();
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
  }, [loadLiveStats]);

  return { liveStats, loading };
}
