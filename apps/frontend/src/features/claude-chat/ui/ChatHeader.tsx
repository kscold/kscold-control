import {
  ArrowLeft,
  FolderOpen,
  Sparkles,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { ClaudeChatSession } from '../lib/claude-chat.types';

interface ChatHeaderProps {
  session: ClaudeChatSession;
  onNewSession: () => void;
  onBackToTerminal?: () => void;
}

export function ChatHeader({
  session,
  onNewSession,
  onBackToTerminal,
}: ChatHeaderProps) {
  const shortSessionId = session.sessionId
    ? session.sessionId.slice(0, 12)
    : 'preparing';

  return (
    <div className="border-b border-white/8 bg-slate-950/80 px-4 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {onBackToTerminal && (
            <button
              onClick={onBackToTerminal}
              className="mt-1 flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:border-white/20 hover:text-white"
              title="터미널로 돌아가기"
            >
              <ArrowLeft size={14} />
              <span>터미널</span>
            </button>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-200">
                <Sparkles size={18} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Claude Workspace
                </h2>
                <p className="text-sm text-slate-400">
                  대화, 도구 실행, 프로젝트 맥락을 한 화면에서 관리합니다.
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
                {session.isReady ? (
                  <>
                    <Wifi size={12} className="text-emerald-400" />
                    <span>대화 준비됨</span>
                  </>
                ) : session.isConnected ? (
                  <>
                    <Wifi size={12} className="text-amber-300" />
                    <span>세션 준비 중</span>
                  </>
                ) : (
                  <>
                    <WifiOff size={12} className="text-rose-400" />
                    <span>연결 끊김</span>
                  </>
                )}
              </span>

              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">
                <FolderOpen size={12} className="text-slate-400" />
                <span className="max-w-[220px] truncate font-mono text-[11px] sm:max-w-[320px]">
                  {session.workingDirectory || '작업 디렉터리 확인 중'}
                </span>
              </span>

              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] text-slate-400">
                session {shortSessionId}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
              Spend
            </p>
            <p className="text-sm font-semibold text-white">
              ${session.totalCostUsd.toFixed(4)}
            </p>
          </div>

          <button
            onClick={onNewSession}
            className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-orange-300/25 hover:bg-white/10 hover:text-white"
            title="새 세션"
          >
            <Trash2 size={15} />
            <span>새 세션</span>
          </button>
        </div>
      </div>
    </div>
  );
}
