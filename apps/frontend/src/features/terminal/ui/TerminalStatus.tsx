import type { TerminalSession } from '../model/terminal.types';

interface TerminalStatusProps {
  session: TerminalSession;
}

/**
 * 연결 상태, 세션 ID, 명령어 사용 횟수를 보여주는 컴포넌트
 */
export function TerminalStatus({ session }: TerminalStatusProps) {
  const { isConnected, sessionId, commandCount, commandLimit } = session;

  return (
    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
      {/* 연결 상태 */}
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
        <span className="text-xs sm:text-sm text-gray-300">
          {isConnected ? '터미널' : '연결 끊김'}
        </span>
      </div>

      {/* 세션 ID (데스크톱에서만 표시) */}
      {sessionId && (
        <span className="hidden sm:inline text-xs text-gray-500 font-mono">
          세션: {sessionId.substring(0, 8)}...
        </span>
      )}

      {/* 명령어 사용 횟수 */}
      {commandLimit !== -1 && (
        <span
          className={`text-xs font-mono ${
            commandCount >= commandLimit
              ? 'text-red-400 font-bold'
              : commandLimit - commandCount <= 3
                ? 'text-yellow-400'
                : 'text-gray-400'
          }`}
        >
          명령어: {commandCount}/{commandLimit}
        </span>
      )}
    </div>
  );
}
