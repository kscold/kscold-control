import { Wifi, WifiOff, Trash2, ArrowLeft } from 'lucide-react';
import { ClaudeChatSession } from '../lib/claude-chat.types';

interface ChatHeaderProps {
  session: ClaudeChatSession;
  onNewSession: () => void;
  onBackToTerminal?: () => void;
}

export function ChatHeader({ session, onNewSession, onBackToTerminal }: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 bg-gray-950">
      <div className="flex items-center gap-3">
        {onBackToTerminal && (
          <button
            onClick={onBackToTerminal}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-800"
            title="터미널로 돌아가기"
          >
            <ArrowLeft size={14} />
            <span>터미널</span>
          </button>
        )}
        <span className="font-semibold text-white text-sm">Claude Chat</span>
        <span className="flex items-center gap-1 text-xs">
          {session.isConnected ? (
            <>
              <Wifi size={12} className="text-green-400" />
              <span className="text-green-400">연결됨</span>
            </>
          ) : (
            <>
              <WifiOff size={12} className="text-red-400" />
              <span className="text-red-400">연결 끊김</span>
            </>
          )}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {session.totalCostUsd > 0 && (
          <span className="text-xs text-gray-500">
            ${session.totalCostUsd.toFixed(4)}
          </span>
        )}
        <button
          onClick={onNewSession}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-gray-800"
          title="새 세션"
        >
          <Trash2 size={14} />
          <span className="hidden sm:inline">새 세션</span>
        </button>
      </div>
    </div>
  );
}
