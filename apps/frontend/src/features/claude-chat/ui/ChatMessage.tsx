import { ChatMessage as ChatMessageType } from '../lib/claude-chat.types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ToolIndicator } from './ToolIndicator';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[85%] sm:max-w-[75%] ${
          isUser
            ? 'bg-blue-600 text-white rounded-2xl rounded-br-md px-4 py-2.5'
            : 'bg-gray-800 text-gray-100 rounded-2xl rounded-bl-md px-4 py-3'
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <>
            {message.tools && message.tools.length > 0 && (
              <ToolIndicator tools={message.tools} />
            )}
            <div className="text-sm prose-sm">
              <MarkdownRenderer content={message.content} />
              {message.isStreaming && !message.content && (
                <span className="inline-flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              )}
              {message.isStreaming && message.content && (
                <span className="inline-block w-1.5 h-4 bg-gray-400 ml-0.5 animate-pulse align-text-bottom" />
              )}
            </div>
            {message.costUsd !== undefined && (
              <div className="mt-2 pt-1.5 border-t border-gray-700 text-xs text-gray-500 flex items-center gap-3">
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
