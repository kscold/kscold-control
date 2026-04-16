import type { ReactNode } from 'react';
import {
  Activity,
  Bot,
  FolderKanban,
  MessagesSquare,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { ChatMessage, ClaudeChatSession } from '../lib/claude-chat.types';

interface ClaudeChatSidebarProps {
  session: ClaudeChatSession;
  messages: ChatMessage[];
  isStreaming: boolean;
  onPromptSelect: (prompt: string) => void;
}

const QUICK_ACTIONS = [
  '이 프로젝트 구조를 빠르게 요약해줘',
  '현재 작업을 위한 체크리스트를 만들어줘',
  '문제가 있는 부분을 먼저 진단해줘',
];

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function shortenPath(path: string | null) {
  if (!path) return '작업 디렉터리 없음';
  if (path.length <= 36) return path;
  return `...${path.slice(-33)}`;
}

export function ClaudeChatSidebar({
  session,
  messages,
  isStreaming,
  onPromptSelect,
}: ClaudeChatSidebarProps) {
  const assistantMessages = messages.filter(
    (message) => message.role === 'assistant',
  );
  const userMessages = messages.filter((message) => message.role === 'user');
  const latestAssistant = [...assistantMessages].reverse()[0];
  const latestTools = latestAssistant?.tools?.slice(-4) || [];

  return (
    <aside className="hidden min-h-0 flex-col border-t border-white/6 bg-slate-950/70 lg:flex lg:border-l lg:border-t-0">
      <div className="overflow-y-auto p-4">
        <div className="rounded-3xl border border-orange-400/15 bg-[linear-gradient(180deg,rgba(249,115,22,0.12),rgba(15,23,42,0.55))] p-4">
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-orange-200/70">
            <Sparkles size={14} />
            <span>Workspace</span>
          </div>
          <p className="text-sm leading-6 text-slate-200">
            Claude가 현재 대화 세션 안에서 프로젝트 맥락을 유지하면서 답변하도록
            설계된 전용 작업 공간입니다.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <MetricCard
            label="Messages"
            value={`${messages.length}`}
            icon={<MessagesSquare size={14} />}
          />
          <MetricCard
            label="Assistant"
            value={`${assistantMessages.length}`}
            icon={<Bot size={14} />}
          />
          <MetricCard
            label="User Turns"
            value={`${userMessages.length}`}
            icon={<Activity size={14} />}
          />
          <MetricCard
            label="Spend"
            value={`$${session.totalCostUsd.toFixed(4)}`}
            icon={<Sparkles size={14} />}
          />
        </div>

        <section className="mt-5 rounded-3xl border border-white/8 bg-white/5 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-500">
            <FolderKanban size={14} />
            <span>Context</span>
          </div>
          <div className="rounded-2xl border border-white/8 bg-slate-950/80 px-3 py-2 font-mono text-xs text-slate-300">
            {shortenPath(session.workingDirectory)}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            세션 ID:{' '}
            {session.sessionId ? session.sessionId.slice(0, 12) : '준비 중'}
          </p>
        </section>

        <section className="mt-5 rounded-3xl border border-white/8 bg-white/5 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-500">
            <Wrench size={14} />
            <span>Tool Activity</span>
          </div>
          {latestTools.length > 0 ? (
            <div className="space-y-2">
              {latestTools.map((tool, index) => (
                <div
                  key={`${tool.tool}-${tool.input}-${index}`}
                  className="rounded-2xl border border-white/8 bg-slate-950/80 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-white">
                      {tool.tool}
                    </span>
                    <span
                      className={`text-[11px] uppercase tracking-[0.18em] ${
                        tool.status === 'end'
                          ? 'text-emerald-300'
                          : 'text-amber-300'
                      }`}
                    >
                      {tool.status === 'end' ? 'done' : 'active'}
                    </span>
                  </div>
                  {tool.input && (
                    <p className="mt-1 line-clamp-2 font-mono text-xs text-slate-400">
                      {tool.input}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              {isStreaming
                ? 'Claude가 응답을 구성 중입니다. 도구 호출이 생기면 여기에 표시됩니다.'
                : '최근 도구 활동이 아직 없습니다.'}
            </p>
          )}
        </section>

        <section className="mt-5 rounded-3xl border border-white/8 bg-white/5 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-500">
            <Sparkles size={14} />
            <span>Quick Prompts</span>
          </div>
          <div className="space-y-2">
            {QUICK_ACTIONS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => onPromptSelect(prompt)}
                className="w-full rounded-2xl border border-white/8 bg-slate-950/80 px-3 py-3 text-left text-sm text-slate-200 transition hover:border-orange-300/30 hover:bg-slate-900"
              >
                {prompt}
              </button>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}
