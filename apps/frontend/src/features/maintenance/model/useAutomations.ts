import { useCallback, useEffect, useRef, useState } from 'react';
import { storageService } from '../api/storage.service';
import type { AutomationsOverview } from './maintenance.types';

const REFRESH_MS = 60_000;

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 자동 작업 현황을 불러오고 1분마다 다시 읽는다. */
export function useAutomations() {
  const [overview, setOverview] = useState<AutomationsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sequenceRef = useRef(0);

  const load = useCallback(async ({ silent = false } = {}) => {
    const sequence = (sequenceRef.current += 1);
    if (!silent) setLoading(true);
    try {
      const next = await storageService.getAutomations();
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
    const timer = window.setInterval(
      () => void load({ silent: true }),
      REFRESH_MS,
    );
    return () => window.clearInterval(timer);
  }, [load]);

  return { overview, loading, error, reload: load };
}
