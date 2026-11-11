import { useCallback, useEffect, useRef, useState } from 'react';
import { securityService } from '../api/security.service';
import type { AttackMapView } from './security.types';

/** 기간을 바꾸거나 새로고침할 때만 읽는다. 지도는 몇 초 단위로 볼 일이 없다. */
export function useAttackMap(days: number) {
  const [data, setData] = useState<AttackMapView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    pending.current?.abort();
    const request = new AbortController();
    pending.current = request;
    setLoading(true);
    try {
      const view = await securityService.getAttackMap(days, request.signal);
      if (request.signal.aborted) return;
      setData(view);
      setError(null);
    } catch (e) {
      if (request.signal.aborted) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (pending.current === request) {
        pending.current = null;
        setLoading(false);
      }
    }
  }, [days]);

  useEffect(() => {
    void load();
    return () => {
      pending.current?.abort();
      pending.current = null;
    };
  }, [load]);

  return { data, loading, error, reload: load };
}
