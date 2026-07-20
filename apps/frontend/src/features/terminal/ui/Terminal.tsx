import { useAuthStore } from '@/shared/model';
import { useModalStore } from '@/shared/model';
import { useTerminalSession } from '../model/useTerminalSession';
import { useTerminalSetup } from '../model/useTerminalSetup';
import { useTerminalSocket } from '../model/useTerminalSocket';
import { getTerminalSessionStorageKey } from '../lib/terminal.constants';
import { TerminalHeader } from './TerminalHeader';

interface TerminalProps {
  terminalId: string;
  onSwitchToClaude?: () => void;
}

/**
 * XTerm.js와 Socket.io로 동작하는 메인 터미널 컴포넌트
 */
export function Terminal({ terminalId, onSwitchToClaude }: TerminalProps) {
  const { token } = useAuthStore();
  const { showConfirm } = useModalStore();
  const storageKey = getTerminalSessionStorageKey(terminalId);

  // 세션 관리
  const {
    session,
    getSavedSessionId,
    handleSessionReady,
    setConnected,
    updateCommandCount,
    clearSession,
  } = useTerminalSession(storageKey);

  // XTerm.js 초기화 (소켓보다 먼저 호출해야 한다)
  const { terminalRef, xterm } = useTerminalSetup({
    onData: (data) => socket.sendInput(data),
    onResize: (cols, rows) => socket.resize(cols, rows),
    onInterrupt: () => socket.interrupt(),
  });

  // Socket.io 연결
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
   * claude 명령어를 실행한다
   */
  const handleClaudeCommand = () => {
    if (onSwitchToClaude) {
      onSwitchToClaude();
    } else if (session.isConnected) {
      socket.sendInput(`${session.claudeLaunchCommand || 'claude'}\r`);
    }
  };

  /**
   * 확인 절차를 거쳐 터미널 세션을 종료한다
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
      <div
        ref={terminalRef}
        className="flex-1 overflow-x-auto p-2 sm:p-4 bg-[#1e1e1e]"
      />
    </div>
  );
}
