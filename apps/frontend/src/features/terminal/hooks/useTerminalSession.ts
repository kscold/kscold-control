import { useState } from 'react';
import { SESSION_STORAGE_KEY } from '../lib/terminal.constants';
import type { TerminalSession } from '../lib/terminal.types';

/**
 * useTerminalSession Hook
 * Manages terminal session state and localStorage
 *
 * Extracted from ClaudeTerminal.tsx lines 22-23, 82-92, 188-206
 */
export function useTerminalSession() {
  const [session, setSession] = useState<TerminalSession>({
    sessionId: null,
    isConnected: false,
    commandCount: 0,
    commandLimit: -1,
  });

  /**
   * Get saved session ID from localStorage
   */
  const getSavedSessionId = (): string | null => {
    return localStorage.getItem(SESSION_STORAGE_KEY);
  };

  /**
   * Update session when connected
   */
  const handleSessionReady = (data: {
    sessionId: string;
    isReconnect: boolean;
  }) => {
    setSession((prev) => ({
      ...prev,
      sessionId: data.sessionId,
    }));
    localStorage.setItem(SESSION_STORAGE_KEY, data.sessionId);
    return data.isReconnect;
  };

  /**
   * Update connection status
   */
  const setConnected = (connected: boolean) => {
    setSession((prev) => ({ ...prev, isConnected: connected }));
  };

  /**
   * Update command count
   */
  const updateCommandCount = (count: number, limit: number) => {
    setSession((prev) => ({
      ...prev,
      commandCount: count,
      commandLimit: limit,
    }));
  };

  /**
   * Clear session (logout or session close)
   */
  const clearSession = () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setSession({
      sessionId: null,
      isConnected: false,
      commandCount: 0,
      commandLimit: -1,
    });
  };

  return {
    session,
    getSavedSessionId,
    handleSessionReady,
    setConnected,
    updateCommandCount,
    clearSession,
  };
}
