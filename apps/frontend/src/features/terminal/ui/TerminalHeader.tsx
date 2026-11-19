import { TerminalStatus } from './TerminalStatus';
import type { TerminalSession } from '../model/terminal.types';

interface TerminalHeaderProps {
  session: TerminalSession;
  onClaudeCommand: () => void;
  onCodexCommand: () => void;
  onCloseSession: () => void;
}

/**
 * 상태 표시와 동작 버튼을 담은 터미널 헤더
 */
export function TerminalHeader({
  session,
  onClaudeCommand,
  onCodexCommand,
  onCloseSession,
}: TerminalHeaderProps) {
  const { isConnected } = session;

  return (
    <div className="bg-gray-800 border-b border-gray-700">
      {/* 상태 표시줄 */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <TerminalStatus session={session} />

        {/* 모바일: 버튼을 같은 줄에 표시 */}
        <div className="flex gap-1.5">
          <button
            onClick={onCodexCommand}
            disabled={!isConnected}
            title="쉘에 codex 명령 입력 · Enter로 실행"
            className="rounded bg-blue-700 px-2 py-1 text-xs text-white hover:bg-blue-600 disabled:opacity-50"
          >
            Codex
          </button>
          <button
            onClick={onClaudeCommand}
            disabled={!isConnected}
            className="px-2 py-1 text-xs bg-[#D97757] text-white rounded hover:bg-[#C86744] disabled:opacity-50 transition-all font-medium"
          >
            Claude
          </button>
          <button
            onClick={onCloseSession}
            disabled={!isConnected}
            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-all font-medium"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
