import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import type { ClaudeRuntimeDiagnostics } from '../lib/terminal.types';

interface UseClaudeRuntimeDiagnosticsOptions {
  enabled?: boolean;
}

export function useClaudeRuntimeDiagnostics({
  enabled = true,
}: UseClaudeRuntimeDiagnosticsOptions = {}) {
  const [report, setReport] = useState<ClaudeRuntimeDiagnostics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostics = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data } = await api.get<ClaudeRuntimeDiagnostics>(
        '/claude-chat/diagnostics',
        {
          params: forceRefresh ? { refresh: '1' } : undefined,
        },
      );
      setReport(data);
      return data;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Claude 런타임 진단을 불러오지 못했습니다.';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void runDiagnostics(false);
  }, [enabled, runDiagnostics]);

  return {
    report,
    isLoading,
    error,
    runDiagnostics,
  };
}
