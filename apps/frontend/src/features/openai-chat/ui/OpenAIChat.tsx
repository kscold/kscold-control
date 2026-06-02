import { useCallback, useState, useRef, useEffect, KeyboardEvent } from 'react';
import { BotMessageSquare, Zap, AlertTriangle, Send, Square } from 'lucide-react';
import { useAuthStore } from '../../../shared/model/auth.store';
import { MarkdownRenderer } from '../../claude-chat/ui/MarkdownRenderer';
import type { OpenAIProvider } from '../lib/openai-chat.types';
import { getOpenAISessionStorageKey } from '../lib/openai-chat.constants';
import { useOpenAIChatSession } from '../hooks/useOpenAIChatSession';
import { useOpenAIChatMessages } from '../hooks/useOpenAIChatMessages';
import { useOpenAIChatSocket } from '../hooks/useOpenAIChatSocket';

interface OpenAIChatProps {
  tabId?: string;
  initialProvider?: OpenAIProvider;
}

const PROVIDER_OPTIONS: { value: OpenAIProvider; label: string; description: string }[] = [
  { value: 'api', label: 'Chat API', description: 'GPT-4o · OpenAI REST API' },
  { value: 'codex', label: 'Codex CLI', description: '@openai/codex · 에이전트 코딩' },
];

const STARTER_PROMPTS = [
  '현재 프로젝트 구조를 간단히 설명해줘',
  '이 코드베이스의 개선점을 찾아줘',
  'Docker 컨테이너 상태를 점검해줘',
];

export function OpenAIChat({ tabId = 'default', initialProvider = 'api' }: OpenAIChatProps) {
  const { token } = useAuthStore();
  const [provider, setProvider] = useState<OpenAIProvider>(initialProvider);
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const storageKey = getOpenAISessionStorageKey(`${tabId}-${provider}`);
  const { session, getSavedSessionId, handleSessionReady, setConnected, setError, clearSession } =
    useOpenAIChatSession(storageKey, provider);
  const [initialSessionId] = useState(() => getSavedSessionId());
  const { messages, isStreaming, addUserMessage, startStreaming, appendDelta, endStreaming, loadHistory, clear: clearMessages } =
    useOpenAIChatMessages();

  const { sendMessage, abort, closeSession } = useOpenAIChatSocket({
    token,
    provider,
    savedSessionId: initialSessionId,
    onSessionReady: handleSessionReady,
    onHistory: useCallback((data: { messages: any[] }) => loadHistory(data.messages), [loadHistory]),
    onMessageStart: startStreaming,
    onTextDelta: useCallback((data: { text: string }) => appendDelta(data.text), [appendDelta]),
    onMessageEnd: useCallback(
      (data: { content: string; provider: OpenAIProvider; model?: string }) => {
        endStreaming(data.content, { provider: data.provider, model: data.model });
      },
      [endStreaming],
    ),
    onError: useCallback((data: { message: string }) => setError(data.message), [setError]),
    onConnect: useCallback(() => setConnected(true), [setConnected]),
    onDisconnect: useCallback(() => setConnected(false), [setConnected]),
    onSessionClosed: useCallback(() => { clearSession(); clearMessages(); }, [clearSession, clearMessages]),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isStreaming || !session.isConnected) return;
    setInput('');
    addUserMessage(text);
    sendMessage(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="flex items-center gap-2.5">
          <BotMessageSquare size={18} className="text-green-400" />
          <span className="text-sm font-medium text-white">OpenAI</span>
          {session.isReady && (
            <span className="text-xs text-gray-500">
              {provider === 'api' ? session.model : 'Codex CLI'}
            </span>
          )}
          <span className={`h-1.5 w-1.5 rounded-full ${session.isConnected ? 'bg-green-500' : 'bg-gray-600'}`} />
        </div>
        <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-0.5">
          {PROVIDER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setProvider(opt.value); clearMessages(); }}
              title={opt.description}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                provider === opt.value ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {opt.value === 'api' ? <BotMessageSquare size={12} /> : <Zap size={12} />}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Warnings */}
      {session.isReady && provider === 'api' && !session.apiConfigured && (
        <div className="mx-4 mt-3 shrink-0 flex items-center gap-2 rounded-lg border border-yellow-700/50 bg-yellow-900/20 px-3 py-2 text-xs text-yellow-400">
          <AlertTriangle size={13} />
          <span>OPENAI_API_KEY가 설정되지 않았습니다. <code className="font-mono">.env</code>에 키를 추가하고 서버를 재시작하세요.</span>
        </div>
      )}
      {session.lastError && (
        <div className="mx-4 mt-2 shrink-0 flex items-center gap-2 rounded-lg border border-red-700/50 bg-red-900/20 px-3 py-2 text-xs text-red-400">
          <AlertTriangle size={13} />
          <span className="flex-1">{session.lastError}</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && session.isReady ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <BotMessageSquare size={32} className="text-gray-700" />
            <p className="text-sm text-gray-500">
              {provider === 'codex' ? 'Codex CLI로 에이전트 코딩을 시작하세요' : `${session.model}과 대화를 시작하세요`}
            </p>
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => { addUserMessage(prompt); sendMessage(prompt); }}
                  className="px-3 py-2 text-xs text-gray-400 border border-gray-800 rounded-lg hover:border-gray-600 hover:text-gray-200 transition-colors text-left"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === 'user'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-800 text-gray-100'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <MarkdownRenderer content={msg.content} />
                ) : (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                )}
                {msg.isStreaming && (
                  <span className="inline-block ml-1 h-3 w-0.5 bg-green-400 animate-pulse" />
                )}
                {msg.role === 'assistant' && msg.model && !msg.isStreaming && (
                  <div className="mt-1.5 text-xs text-gray-500">{msg.model}</div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 pb-4">
        <div className="flex items-end gap-2 rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 focus-within:border-green-600 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={!session.isConnected || isStreaming}
            placeholder={
              !session.isConnected
                ? '연결 중...'
                : provider === 'codex'
                  ? 'Codex에게 코딩 작업을 지시하세요...'
                  : `${session.model || 'GPT'}에게 질문하세요...`
            }
            className="flex-1 resize-none bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none disabled:opacity-50 max-h-32"
            style={{ fieldSizing: 'content' } as any}
          />
          {isStreaming ? (
            <button
              onClick={abort}
              className="shrink-0 p-1.5 rounded-lg bg-gray-700 text-red-400 hover:bg-gray-600 transition-colors"
              title="중단"
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || !session.isConnected}
              className="shrink-0 p-1.5 rounded-lg bg-green-600 text-white hover:bg-green-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="전송"
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
