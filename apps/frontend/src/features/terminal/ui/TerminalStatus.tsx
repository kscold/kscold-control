import type { TerminalSession } from '../lib/terminal.types';

interface TerminalStatusProps {
  session: TerminalSession;
}

/**
 * TerminalStatus Component
 * Displays connection status, session ID, and command count
 *
 * Extracted from ClaudeTerminal.tsx lines 213-243
 */
export function TerminalStatus({ session }: TerminalStatusProps) {
  const { isConnected, sessionId, commandCount, commandLimit } = session;

  return (
    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
      {/* Connection Status */}
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

      {/* Session ID (Desktop only) */}
      {sessionId && (
        <span className="hidden sm:inline text-xs text-gray-500 font-mono">
          세션: {sessionId.substring(0, 8)}...
        </span>
      )}

      {/* Command Count */}
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
