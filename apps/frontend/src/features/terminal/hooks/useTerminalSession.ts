import { useState } from 'react';
import type { TerminalSession } from '../lib/terminal.types';

/**
 * useTerminalSession Hook
 * Manages terminal session state and localStorage
 *
 * Extracted from ClaudeTerminal.tsx lines 22-23, 82-92, 188-206
 */
export function useTerminalSession(storageKey: string) {
  const [session, setSession] = useState<TerminalSession>({
    sessionId: null,
    isConnected: false,
    commandCount: 0,
    commandLimit: -1,
    workingDirectory: null,
    shellPath: null,
    claudeBinaryPath: null,
    claudeLaunchCommand: null,
  });

  /**
   * Get saved session ID from localStorage
   */
  const getSavedSessionId = (): string | null => {
    return localStorage.getItem(storageKey);
  };

  /**
   * Update session when connected
   */
  const handleSessionReady = (data: {
    sessionId: string;
    isReconnect: boolean;
    workingDirectory?: string | null;
    shellPath?: string | null;
    claudeBinaryPath?: string | null;
    claudeLaunchCommand?: string | null;
  }) => {
    setSession((prev) => ({
      ...prev,
      sessionId: data.sessionId,
      workingDirectory: data.workingDirectory ?? prev.workingDirectory,
      shellPath: data.shellPath ?? prev.shellPath,
      claudeBinaryPath: data.claudeBinaryPath ?? prev.claudeBinaryPath,
      claudeLaunchCommand: data.claudeLaunchCommand ?? prev.claudeLaunchCommand,
    }));
    localStorage.setItem(storageKey, data.sessionId);
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
    localStorage.removeItem(storageKey);
    setSession({
      sessionId: null,
      isConnected: false,
      commandCount: 0,
      commandLimit: -1,
      workingDirectory: null,
      shellPath: null,
      claudeBinaryPath: null,
      claudeLaunchCommand: null,
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
