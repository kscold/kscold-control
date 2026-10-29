import { useCallback, useEffect, useRef, useState } from 'react';
import { storageService } from '../api/storage.service';
import type { StorageOverview } from './maintenance.types';

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 저장공간 현황을 불러온다. refresh는 서버가 10분 동안 다시 쓰던 결과를 버리고 새로 잰다. */
export function useStorageOverview() {
  const [overview, setOverview] = useState<StorageOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sequenceRef = useRef(0);

  const load = useCallback(async ({ refresh = false } = {}) => {
    const sequence = (sequenceRef.current += 1);
    setLoading(true);
    try {
      const next = await storageService.getOverview(refresh);
      if (sequence !== sequenceRef.current) return;
      setOverview(next);
      setError(null);
    } catch (caught) {
      if (sequence === sequenceRef.current) setError(toMessage(caught));
    } finally {
      if (sequence === sequenceRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { overview, loading, error, reload: load };
}
