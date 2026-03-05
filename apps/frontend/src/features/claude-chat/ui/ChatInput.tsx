import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { Send, Square } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  onAbort: () => void;
  isStreaming: boolean;
  isConnected: boolean;
}

export function ChatInput({ onSend, onAbort, isStreaming, isConnected }: ChatInputProps) {
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
    if (!trimmed || isStreaming || !isConnected) return;
    onSend(trimmed);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, isStreaming, isConnected, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="border-t border-gray-800 bg-gray-950 p-3">
      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            adjustHeight();
          }}
          onKeyDown={handleKeyDown}
          placeholder={isConnected ? '메시지를 입력하세요...' : '연결 중...'}
          disabled={!isConnected}
          rows={1}
          className="flex-1 resize-none bg-gray-800 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 scrollbar-thin"
        />
        {isStreaming ? (
          <button
            onClick={onAbort}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors"
            title="중지"
          >
            <Square size={18} />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim() || !isConnected}
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl transition-colors"
            title="전송"
          >
            <Send size={18} />
          </button>
        )}
      </div>
      <p className="text-center text-xs text-gray-600 mt-1.5">
        Enter 전송 · Shift+Enter 줄바꿈
      </p>
    </div>
  );
}
