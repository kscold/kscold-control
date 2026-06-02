import { useState, useCallback } from 'react';
import type { OpenAIChatSession, OpenAIProvider } from '../lib/openai-chat.types';

export function useOpenAIChatSession(
  storageKey: string,
  initialProvider: OpenAIProvider,
) {
  const [session, setSession] = useState<OpenAIChatSession>({
    sessionId: null,
    isConnected: false,
    isReady: false,
    provider: initialProvider,
    model: 'gpt-4o',
    apiConfigured: false,
    lastError: null,
  });

  const getSavedSessionId = useCallback(
    () => localStorage.getItem(storageKey),
    [storageKey],
  );

  const handleSessionReady = useCallback(
    (data: {
      sessionId: string;
      isReconnect: boolean;
      provider: OpenAIProvider;
      model: string;
      apiConfigured: boolean;
    }) => {
      localStorage.setItem(storageKey, data.sessionId);
      setSession((prev) => ({
        ...prev,
        sessionId: data.sessionId,
        isReady: true,
        isConnected: true,
        provider: data.provider,
        model: data.model,
        apiConfigured: data.apiConfigured,
        lastError: null,
      }));
    },
    [storageKey],
  );

  const setConnected = useCallback((connected: boolean) => {
    setSession((prev) => ({ ...prev, isConnected: connected, isReady: connected ? prev.isReady : false }));
  }, []);

  const setError = useCallback((message: string) => {
    setSession((prev) => ({ ...prev, lastError: message }));
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(storageKey);
    setSession((prev) => ({
      ...prev,
      sessionId: null,
      isReady: false,
      lastError: null,
    }));
  }, [storageKey]);

  return { session, getSavedSessionId, handleSessionReady, setConnected, setError, clearSession };
}
