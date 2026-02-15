import { TerminalStatus } from './TerminalStatus';
import type { TerminalSession } from '../lib/terminal.types';

interface TerminalHeaderProps {
  session: TerminalSession;
  onClaudeCommand: () => void;
  onCloseSession: () => void;
}

/**
 * TerminalHeader Component
 * Terminal header with status and action buttons
 *
 * Extracted from ClaudeTerminal.tsx lines 211-279
 */
export function TerminalHeader({
  session,
  onClaudeCommand,
  onCloseSession,
}: TerminalHeaderProps) {
  const { isConnected } = session;

  return (
    <div className="bg-gray-800 border-b border-gray-700">
      {/* 상태 표시줄 */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-gray-700 sm:border-0">
        <TerminalStatus session={session} />

        {/* 모바일: 버튼을 같은 줄에 표시 */}
        <div className="flex gap-1.5 sm:hidden">
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

      {/* 데스크톱: 버튼을 별도 줄에 표시 */}
      <div className="hidden sm:flex items-center justify-end gap-2 px-4 py-2">
        <button
          onClick={onClaudeCommand}
          disabled={!isConnected}
          className="px-3 py-1.5 text-sm bg-[#D97757] text-white rounded-md hover:bg-[#C86744] disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
        >
          Claude 실행
        </button>
        <button
          onClick={onCloseSession}
          disabled={!isConnected}
          className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
        >
          세션 닫기
        </button>
      </div>
    </div>
  );
}
