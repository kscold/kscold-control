import { useCallback, useState } from 'react';
import { useAuthStore } from '../../../shared/model';
import { useClaudeChatSession } from '../hooks/useClaudeChatSession';
import { useClaudeChatMessages } from '../hooks/useClaudeChatMessages';
import { useClaudeChatSocket } from '../hooks/useClaudeChatSocket';
import { getClaudeSessionStorageKey } from '../lib/claude-chat.constants';
import { ChatHeader } from './ChatHeader';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import { ClaudeChatSidebar } from './ClaudeChatSidebar';

interface ClaudeChatProps {
  tabId?: string;
  onBackToTerminal?: () => void;
}

const STARTER_PROMPTS = [
  '현재 프로젝트 구조를 5줄 안에 요약해줘',
  '이 코드베이스에서 먼저 손봐야 할 위험 요소를 찾아줘',
  '다음 작업을 진행하기 위한 실행 계획을 제안해줘',
];

export function ClaudeChat({
  tabId = 'default',
  onBackToTerminal,
}: ClaudeChatProps = {}) {
  const { token } = useAuthStore();
  const storageKey = getClaudeSessionStorageKey(tabId);
  const {
    session,
    getSavedSessionId,
    handleSessionReady,
    setConnected,
    updateCost,
    setError,
    clearSession,
  } = useClaudeChatSession(storageKey);

  // 마운트 시점 sessionId를 한 번만 캡처 — handleSessionReady가 localStorage를
  // 업데이트해도 소켓 effect가 재실행되지 않도록 방지
  const [initialSessionId] = useState(() => getSavedSessionId());

  const {
    messages,
    isStreaming,
    addUserMessage,
    startStreaming,
    appendDelta,
    addToolUse,
    endStreaming,
    loadHistory,
    clear: clearMessages,
  } = useClaudeChatMessages();

  const { sendMessage, abort, closeSession } = useClaudeChatSocket({
    token,
    savedSessionId: initialSessionId,
    onSessionReady: handleSessionReady,
    onHistory: useCallback(
      (data: { messages: any[] }) => {
        loadHistory(data.messages);
      },
      [loadHistory],
    ),
    onMessageStart: startStreaming,
    onTextDelta: useCallback(
      (data: { text: string }) => {
        appendDelta(data.text);
      },
      [appendDelta],
    ),
    onToolUse: useCallback(
      (data: { tool: string; input: string; status: string }) => {
        addToolUse({
          tool: data.tool,
          input: data.input,
          status: data.status as 'start' | 'end',
        });
      },
      [addToolUse],
    ),
    onMessageEnd: useCallback(
      (data: {
        content: string;
        costUsd: number;
        durationMs: number;
        totalCostUsd: number;
      }) => {
        endStreaming({
          content: data.content,
          costUsd: data.costUsd,
          durationMs: data.durationMs,
        });
        updateCost(data.totalCostUsd);
      },
      [endStreaming, updateCost],
    ),
    onError: useCallback(
      (data: { message: string }) => {
        setError(data.message);
        // 에러 텍스트를 스트리밍 메시지에 추가 (message-end가 오기 전 표시용)
        appendDelta(`\n\n⚠️ ${data.message}`);
      },
      [appendDelta, setError],
    ),
    onConnect: useCallback(() => {
      setConnected(true);
    }, [setConnected]),
    onDisconnect: useCallback(() => {
      setConnected(false);
    }, [setConnected]),
    onSessionClosed: useCallback(() => {
      clearMessages();
      clearSession();
    }, [clearMessages, clearSession]),
  });

  const handleSend = useCallback(
    (message: string) => {
      if (!session.isReady || !session.sessionId) {
        setError('세션이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
        return;
      }

      const sent = sendMessage(message);
      if (!sent) {
        setError(
          '소켓 연결이 불안정합니다. 연결 상태를 확인한 뒤 다시 시도해주세요.',
        );
        return;
      }

      setError(null);
      addUserMessage(message);
    },
    [addUserMessage, sendMessage, session.isReady, session.sessionId, setError],
  );

  const handleNewSession = useCallback(() => {
    closeSession();
    clearSession();
    clearMessages();
  }, [closeSession, clearSession, clearMessages]);

  const canSend = session.isConnected && session.isReady && !!session.sessionId;

  return (
    <div className="h-full bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.14),transparent_28%),linear-gradient(180deg,#020617,#0f172a)] p-2 sm:p-4">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/80 shadow-[0_24px_80px_rgba(2,6,23,0.55)] backdrop-blur">
        <ChatHeader
          session={session}
          onNewSession={handleNewSession}
          onBackToTerminal={onBackToTerminal}
        />

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-h-0 flex-col">
            {session.lastError && (
              <div className="mx-4 mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {session.lastError}
              </div>
            )}

            <ChatMessageList
              messages={messages}
              isStreaming={isStreaming}
              starterPrompts={STARTER_PROMPTS}
              onSelectPrompt={handleSend}
            />
            <ChatInput
              onSend={handleSend}
              onAbort={abort}
              isStreaming={isStreaming}
              isConnected={session.isConnected}
              isReady={canSend}
              workingDirectory={session.workingDirectory}
            />
          </div>

          <ClaudeChatSidebar
            session={session}
            messages={messages}
            isStreaming={isStreaming}
            onPromptSelect={handleSend}
          />
        </div>
      </div>
    </div>
  );
}
