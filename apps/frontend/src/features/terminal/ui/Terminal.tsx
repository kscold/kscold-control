import { useRef } from 'react';
import { useAuthStore } from '@/shared/model';
import { useModalStore } from '@/shared/model';
import { useTerminalSession } from '../model/useTerminalSession';
import { useTerminalSetup } from '../model/useTerminalSetup';
import { useTerminalSocket } from '../model/useTerminalSocket';
import { getTerminalSessionStorageKey } from '../lib/terminal.constants';
import { TerminalCopySheet } from './TerminalCopySheet';
import { TerminalHeader } from './TerminalHeader';
import { TerminalComposer } from './TerminalComposer';
import { TerminalKeyBar } from './TerminalKeyBar';

interface TerminalProps {
  terminalId: string;
  launch?: 'codex' | 'claude';
  onLaunch?: (agent: 'codex' | 'claude') => void;
}

// 버튼으로 실행할 때는 매번 권한 확인을 묻지 않는 모드로 띄운다 (휴대폰에서 승인 누르기가 번거로움)
const CLAUDE_BYPASS_FLAG = '--dangerously-skip-permissions';
const CODEX_LAUNCH = 'codex --dangerously-bypass-approvals-and-sandbox';

function agentCommand(
  agent: 'codex' | 'claude',
  claudeCommand?: string | null,
) {
  return agent === 'claude'
    ? `${claudeCommand || 'claude'} ${CLAUDE_BYPASS_FLAG}`
    : CODEX_LAUNCH;
}

/**
 * XTerm.js와 Socket.io로 동작하는 메인 터미널 컴포넌트
 */
export function Terminal({ terminalId, launch, onLaunch }: TerminalProps) {
  const launched = useRef(false);
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
  const socket: ReturnType<typeof useTerminalSocket> = useTerminalSocket({
    token,
    xterm,
    savedSessionId: getSavedSessionId(),
    onSessionReady: (data) => {
      const reconnected = handleSessionReady(data);
      if (launch && !reconnected && !launched.current) {
        launched.current = true;
        socket.sendInput(`${agentCommand(launch, data.claudeLaunchCommand)}\r`);
        xterm?.focus();
      }
      return reconnected;
    },
    onConnected: () => setConnected(true),
    onDisconnected: () => setConnected(false),
    onCommandCount: updateCommandCount,
  });

  /**
   * claude 명령어를 실행한다
   */
  const handleClaudeCommand = () => {
    if (onLaunch) {
      onLaunch('claude');
    } else if (session.isConnected) {
      socket.sendInput(
        `${agentCommand('claude', session.claudeLaunchCommand)}\r`,
      );
      xterm?.focus();
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
        onCodexCommand={() => {
          if (onLaunch) {
            onLaunch('codex');
            return;
          }
          if (!session.isConnected) return;
          socket.sendInput(`${agentCommand('codex')}\r`);
          xterm?.focus();
        }}
        onCloseSession={handleCloseSession}
      />
      <div className="relative flex min-h-0 flex-1">
        <div
          ref={terminalRef}
          className="min-w-0 flex-1 overflow-hidden p-2 sm:p-4 bg-[#1e1e1e]"
        />
        <TerminalCopySheet xterm={xterm} />
      </div>
      <TerminalKeyBar
        disabled={!session.isConnected}
        // 포커스를 옮기지 않아야 입력칸에 떠 있는 휴대폰 키보드가 내려가지 않는다
        onKey={(sequence) => socket.sendInput(sequence)}
      />
      <TerminalComposer
        disabled={!session.isConnected}
        onSend={(text) => {
          if (text) socket.sendInput(text);
          // 글자와 Enter 를 한 번에 보내면 Claude·Codex 가 붙여넣기로 보고 줄바꿈만 넣는다
          window.setTimeout(() => socket.sendInput('\r'), text ? 80 : 0);
        }}
        onUploadImage={socket.uploadImage}
      />
    </div>
  );
}
