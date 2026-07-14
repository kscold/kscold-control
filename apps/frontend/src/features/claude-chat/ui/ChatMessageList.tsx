import { useEffect, useRef } from 'react';
import { ChatMessage as ChatMessageType } from '../model/claude-chat.types';
import { ChatMessage } from './ChatMessage';

interface ChatMessageListProps {
  messages: ChatMessageType[];
  isStreaming: boolean;
  starterPrompts: string[];
  onSelectPrompt: (prompt: string) => void;
}

export function ChatMessageList({
  messages,
  isStreaming,
  starterPrompts,
  onSelectPrompt,
}: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll when new messages arrive or during streaming
    const container = containerRef.current;
    if (!container) return;

    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      100;

    if (isNearBottom || isStreaming) {
      bottomRef.current?.scrollIntoView({
        behavior: isStreaming ? 'auto' : 'smooth',
      });
    }
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-8 text-slate-400">
        <div className="w-full max-w-4xl rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(2,6,23,0.92))] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.45)] sm:p-8">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex rounded-full border border-orange-400/25 bg-orange-500/10 px-3 py-1 text-xs uppercase tracking-[0.28em] text-orange-200/80">
              Claude Workspace
            </div>
            <h3 className="text-2xl font-semibold text-white sm:text-3xl">
              프로젝트 문맥을 유지한 채 대화를 시작하세요
            </h3>
            <p className="mt-3 text-sm leading-7 text-slate-400 sm:text-base">
              단순 프롬프트 입력창이 아니라, 코드 작업 흐름과 도구 실행 상태까지
              함께 보는 작업 공간으로 설계했습니다.
            </p>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {starterPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => onSelectPrompt(prompt)}
                className="rounded-3xl border border-white/8 bg-white/5 p-4 text-left transition hover:border-orange-300/30 hover:bg-white/10"
              >
                <p className="text-sm font-medium text-white">{prompt}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.22em] text-slate-500">
                  Quick start
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-5 scrollbar-thin sm:px-6"
    >
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 text-xs uppercase tracking-[0.28em] text-slate-500">
          Conversation
        </div>
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
