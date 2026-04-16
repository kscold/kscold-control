import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { Send, Sparkles, Square } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  onAbort: () => void;
  isStreaming: boolean;
  isConnected: boolean;
  isReady: boolean;
  workingDirectory: string | null;
}

function createPlaceholder(isConnected: boolean, isReady: boolean) {
  if (!isConnected) return 'Claude 채팅 서버에 연결하는 중입니다...';
  if (!isReady) return '세션을 준비하는 중입니다...';
  return '프로젝트에 대해 요청하거나, 수정 방향을 설명해보세요...';
}

export function ChatInput({
  onSend,
  onAbort,
  isStreaming,
  isConnected,
  isReady,
  workingDirectory,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || !isReady) return;
    onSend(trimmed);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, isStreaming, isReady, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // e.nativeEvent.isComposing: 한국어 IME 조합 중 Enter 이중 발사 방지
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="border-t border-white/8 bg-slate-950/80 p-4">
      <div className="mx-auto max-w-4xl rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(2,6,23,0.96))] p-3 shadow-[0_18px_60px_rgba(2,6,23,0.4)]">
        <div className="mb-3 flex flex-wrap items-center gap-2 px-1">
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/25 bg-orange-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-orange-200/80">
            <Sparkles size={12} />
            {isStreaming
              ? 'Responding'
              : isReady
                ? 'Ready'
                : isConnected
                  ? 'Booting'
                  : 'Offline'}
          </span>
          <span className="max-w-full truncate rounded-full border border-white/8 bg-white/5 px-3 py-1 font-mono text-[11px] text-slate-400">
            {workingDirectory || 'working directory pending'}
          </span>
        </div>

        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              adjustHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder={createPlaceholder(isConnected, isReady)}
            disabled={!isReady || isStreaming}
            rows={1}
            className="min-h-[60px] flex-1 resize-none rounded-[22px] border border-white/8 bg-slate-900/80 px-4 py-3 text-sm leading-6 text-white placeholder:text-slate-500 focus:border-orange-300/35 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
          {isStreaming ? (
            <button
              onClick={onAbort}
              className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white transition hover:bg-rose-500"
              title="중지"
            >
              <Square size={18} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || !isReady}
              className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
              title="전송"
            >
              <Send size={18} />
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500">
          <span>Enter 전송 · Shift+Enter 줄바꿈 · 준비 완료 후 전송 가능</span>
          <span>{input.trim().length} chars</span>
        </div>
      </div>
    </div>
  );
}
