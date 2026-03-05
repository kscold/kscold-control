import { useCallback, useState } from 'react';
import { useAuthStore } from '../../../stores/auth.store';
import { useClaudeChatSession } from '../hooks/useClaudeChatSession';
import { useClaudeChatMessages } from '../hooks/useClaudeChatMessages';
import { useClaudeChatSocket } from '../hooks/useClaudeChatSocket';
import { ChatHeader } from './ChatHeader';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';

export function ClaudeChat() {
  const { token } = useAuthStore();
  const {
    session,
    getSavedSessionId,
    handleSessionReady,
    setConnected,
    updateCost,
    clearSession,
  } = useClaudeChatSession();

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
        // Append error as assistant message content
        appendDelta(`\n\n⚠️ Error: ${data.message}`);
      },
      [appendDelta],
    ),
    onConnect: useCallback(() => {
      setConnected(true);
    }, [setConnected]),
    onDisconnect: useCallback(() => {
      setConnected(false);
    }, [setConnected]),
  });

  const handleSend = useCallback(
    (message: string) => {
      addUserMessage(message);
      sendMessage(message);
    },
    [addUserMessage, sendMessage],
  );

  const handleNewSession = useCallback(() => {
    closeSession();
    clearSession();
    clearMessages();
  }, [closeSession, clearSession, clearMessages]);

  return (
    <div className="h-full flex flex-col bg-gray-950">
      <ChatHeader session={session} onNewSession={handleNewSession} />
      <ChatMessageList messages={messages} isStreaming={isStreaming} />
      <ChatInput
        onSend={handleSend}
        onAbort={abort}
        isStreaming={isStreaming}
        isConnected={session.isConnected}
      />
    </div>
  );
}
