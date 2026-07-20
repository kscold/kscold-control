import { useState } from 'react';
import type { TerminalSession } from '../model/terminal.types';

/**
 * 터미널 세션 상태와 localStorage 저장을 관리하는 훅
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
   * localStorage에 저장된 세션 ID를 가져온다
   */
  const getSavedSessionId = (): string | null => {
    return localStorage.getItem(storageKey);
  };

  /**
   * 연결이 완료되면 세션 정보를 갱신한다
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
   * 연결 상태를 갱신한다
   */
  const setConnected = (connected: boolean) => {
    setSession((prev) => ({ ...prev, isConnected: connected }));
  };

  /**
   * 명령어 사용 횟수를 갱신한다
   */
  const updateCommandCount = (count: number, limit: number) => {
    setSession((prev) => ({
      ...prev,
      commandCount: count,
      commandLimit: limit,
    }));
  };

  /**
   * 세션을 초기화한다 (로그아웃 또는 세션 종료 시)
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
