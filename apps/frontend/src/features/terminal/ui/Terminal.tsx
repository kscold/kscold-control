import { useAuthStore } from '../../../stores/auth.store';
import { useModalStore } from '../../../stores/modal.store';
import { useTerminalSession } from '../hooks/useTerminalSession';
import { useTerminalSetup } from '../hooks/useTerminalSetup';
import { useTerminalSocket } from '../hooks/useTerminalSocket';
import { TerminalHeader } from './TerminalHeader';

interface TerminalProps {
  terminalId: string;
}

/**
 * Terminal Component
 * Main terminal component with XTerm.js and Socket.io
 *
 * Refactored from ClaudeTerminal.tsx (284 LOC → ~80 LOC)
 * Uses FSD architecture with custom hooks
 */
export function Terminal({ terminalId }: TerminalProps) {
  const { token } = useAuthStore();
  const { showConfirm } = useModalStore();

  // Session management
  const {
    session,
    getSavedSessionId,
    handleSessionReady,
    setConnected,
    updateCommandCount,
    clearSession,
  } = useTerminalSession();

  // XTerm.js setup (must be called before socket)
  const { terminalRef, xterm } = useTerminalSetup({
    onData: (data) => socket.sendInput(data),
    onResize: (cols, rows) => socket.resize(cols, rows),
    onInterrupt: () => socket.interrupt(),
  });

  // Socket.io connection
  const socket = useTerminalSocket({
    token,
    xterm,
    savedSessionId: getSavedSessionId(),
    onSessionReady: handleSessionReady,
    onConnected: () => setConnected(true),
    onDisconnected: () => setConnected(false),
    onCommandCount: updateCommandCount,
  });

  /**
   * Execute claude command
   */
  const handleClaudeCommand = () => {
    if (socket.socket && session.isConnected) {
      socket.sendInput('claude\n');
    }
  };

  /**
   * Close terminal session with confirmation
   */
  const handleCloseSession = () => {
    showConfirm(
      '현재 터미널 세션을 종료하시겠습니까?\n(진행 중인 작업이 있다면 저장하세요)',
      () => {
        socket.closeSession();
        clearSession();
        setTimeout(() => window.location.reload(), 500);
      },
      '세션 닫기',
    );
  };

  return (
    <div className="flex flex-col h-full">
      <TerminalHeader
        session={session}
        onClaudeCommand={handleClaudeCommand}
        onCloseSession={handleCloseSession}
      />
      <div ref={terminalRef} className="flex-1 p-2 sm:p-4 bg-[#1e1e1e]" />
    </div>
  );
}
