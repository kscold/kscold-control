import { useState, useCallback } from 'react';
import { ClaudeChatSession } from '../model/claude-chat.types';

function createInitialSessionState(): ClaudeChatSession {
  return {
    sessionId: null,
    isConnected: false,
    isReady: false,
    totalCostUsd: 0,
    workingDirectory: null,
    lastError: null,
  };
}

export function useClaudeChatSession(storageKey: string) {
  const [session, setSession] = useState<ClaudeChatSession>({
    ...createInitialSessionState(),
  });

  const getSavedSessionId = useCallback((): string | null => {
    return localStorage.getItem(storageKey);
  }, [storageKey]);

  const handleSessionReady = useCallback(
    (data: {
      sessionId: string;
      isReconnect: boolean;
      workingDirectory?: string | null;
    }) => {
      setSession((prev) => ({
        ...prev,
        sessionId: data.sessionId,
        isConnected: true,
        isReady: true,
        workingDirectory: data.workingDirectory ?? prev.workingDirectory,
        lastError: null,
      }));
      localStorage.setItem(storageKey, data.sessionId);
    },
    [storageKey],
  );

  const setConnected = useCallback((connected: boolean) => {
    setSession((prev) => ({
      ...prev,
      isConnected: connected,
      isReady: connected ? prev.isReady : false,
    }));
  }, []);

  const updateCost = useCallback((totalCostUsd: number) => {
    setSession((prev) => ({ ...prev, totalCostUsd }));
  }, []);

  const setError = useCallback((message: string | null) => {
    setSession((prev) => ({ ...prev, lastError: message }));
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(storageKey);
    setSession(createInitialSessionState());
  }, [storageKey]);

  return {
    session,
    getSavedSessionId,
    handleSessionReady,
    setConnected,
    updateCost,
    setError,
    clearSession,
  };
}
