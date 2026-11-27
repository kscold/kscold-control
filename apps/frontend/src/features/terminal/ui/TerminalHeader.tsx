import { Asterisk, Code2 } from 'lucide-react';
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
            title="Codex 실행 (승인 없이)"
            aria-label="Codex 실행"
            className="rounded-md border border-sky-400/30 p-1.5 text-sky-300 hover:bg-sky-400/15 disabled:opacity-50"
          >
            <Code2 size={17} aria-hidden="true" />
          </button>
          <button
            onClick={onClaudeCommand}
            disabled={!isConnected}
            title="Claude 실행 (권한 확인 없이)"
            aria-label="Claude 실행"
            className="rounded-md border border-orange-400/30 p-1.5 text-orange-300 hover:bg-orange-400/15 disabled:opacity-50"
          >
            <Asterisk size={17} aria-hidden="true" />
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
