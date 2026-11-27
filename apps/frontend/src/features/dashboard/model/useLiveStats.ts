import { useState, useCallback, useEffect, useRef } from 'react';
import { dashboardService } from '../api/dashboard.service';
import type { LiveStats } from './dashboard.types';

export function useLiveStats() {
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);
  const [loading, setLoading] = useState(true);
  // 실패를 숨기면 0 이나 옛 값이 지금 값처럼 보인다
  const [failed, setFailed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadLiveStats = useCallback(async () => {
    try {
      setLoading(true);
      setLiveStats(await dashboardService.getLiveStats());
      setFailed(false);
    } catch (e) {
      console.error(e);
      setFailed(true);
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

  return { liveStats, loading, failed };
}
