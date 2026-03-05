import { useState, useCallback } from 'react';
import { CLAUDE_SESSION_STORAGE_KEY } from '../lib/claude-chat.constants';
import { ClaudeChatSession } from '../lib/claude-chat.types';

export function useClaudeChatSession() {
  const [session, setSession] = useState<ClaudeChatSession>({
    sessionId: null,
    isConnected: false,
    totalCostUsd: 0,
  });

  const getSavedSessionId = useCallback((): string | null => {
    return localStorage.getItem(CLAUDE_SESSION_STORAGE_KEY);
  }, []);

  const handleSessionReady = useCallback(
    (data: { sessionId: string; isReconnect: boolean }) => {
      setSession((prev) => ({
        ...prev,
        sessionId: data.sessionId,
        isConnected: true,
      }));
      localStorage.setItem(CLAUDE_SESSION_STORAGE_KEY, data.sessionId);
    },
    [],
  );

  const setConnected = useCallback((connected: boolean) => {
    setSession((prev) => ({ ...prev, isConnected: connected }));
  }, []);

  const updateCost = useCallback((totalCostUsd: number) => {
    setSession((prev) => ({ ...prev, totalCostUsd }));
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(CLAUDE_SESSION_STORAGE_KEY);
    setSession({ sessionId: null, isConnected: false, totalCostUsd: 0 });
  }, []);

  return {
    session,
    getSavedSessionId,
    handleSessionReady,
    setConnected,
    updateCost,
    clearSession,
  };
}
