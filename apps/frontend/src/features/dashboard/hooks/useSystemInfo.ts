import { useState, useCallback } from 'react';
import { api } from '../../../lib/api';
import type { SystemInfo } from '../lib/dashboard.types';

export function useSystemInfo() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);

  const loadSystemInfo = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get<SystemInfo>('/system/info');
      setSystemInfo(data);
      setLastLoadedAt(Date.now());
    } catch (e) {
      console.error(e);
      setError('시스템 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  return { systemInfo, loadSystemInfo, loading, error, lastLoadedAt };
}
