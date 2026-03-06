import { useState, useCallback } from 'react';
import { api } from '../../../lib/api';
import type { SystemInfo } from '../lib/dashboard.types';

export function useSystemInfo() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);

  const loadSystemInfo = useCallback(async () => {
    try {
      const { data } = await api.get<SystemInfo>('/system/info');
      setSystemInfo(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  return { systemInfo, loadSystemInfo };
}
