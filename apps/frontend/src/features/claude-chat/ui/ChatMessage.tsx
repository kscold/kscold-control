import { ChatMessage as ChatMessageType } from '../model/claude-chat.types';
import { MarkdownRenderer } from '@/shared/ui';
import { ToolIndicator } from './ToolIndicator';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const timestamp = message.timestamp.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`mb-4 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[92%] sm:max-w-[78%] ${
          isUser
            ? 'rounded-[26px] rounded-br-lg border border-orange-300/20 bg-[linear-gradient(180deg,rgba(251,146,60,0.95),rgba(234,88,12,0.92))] px-4 py-3 text-white shadow-[0_18px_48px_rgba(249,115,22,0.18)]'
            : 'rounded-[26px] rounded-bl-lg border border-white/8 bg-[linear-gradient(180deg,rgba(30,41,59,0.92),rgba(15,23,42,0.92))] px-4 py-4 text-slate-100'
        }`}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.24em] ${
                isUser
                  ? 'bg-white/15 text-orange-50'
                  : 'border border-white/10 bg-white/5 text-slate-300'
              }`}
            >
              {isUser ? 'You' : 'Claude'}
            </span>
            {message.isStreaming && (
              <span className="text-[11px] uppercase tracking-[0.24em] text-amber-300">
                streaming
              </span>
            )}
          </div>
          <span
            className={`text-xs ${isUser ? 'text-orange-100/80' : 'text-slate-500'}`}
          >
            {timestamp}
          </span>
        </div>

        {isUser ? (
          <p className="whitespace-pre-wrap break-words text-sm leading-7">
            {message.content}
          </p>
        ) : (
          <>
            {message.tools && message.tools.length > 0 && (
              <ToolIndicator tools={message.tools} />
            )}
            <div className="text-sm">
              <MarkdownRenderer content={message.content} />
              {message.isStreaming && !message.content && (
                <span className="inline-flex gap-1">
                  <span
                    className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                    style={{ animationDelay: '300ms' }}
                  />
                </span>
              )}
              {message.isStreaming && message.content && (
                <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse align-text-bottom bg-amber-300" />
              )}
            </div>
            {message.costUsd !== undefined && (
              <div className="mt-4 flex items-center gap-3 border-t border-white/8 pt-2 text-xs text-slate-500">
                <span>${message.costUsd.toFixed(4)}</span>
                {message.durationMs && (
                  <span>{(message.durationMs / 1000).toFixed(1)}s</span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
