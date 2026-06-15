import { useState, useCallback, useRef } from 'react';
import type {
  OpenAIChatMessage,
  OpenAIProvider,
} from '../lib/openai-chat.types';

export function useOpenAIChatMessages() {
  const [messages, setMessages] = useState<OpenAIChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const streamingIdRef = useRef<string | null>(null);

  const addUserMessage = useCallback((content: string) => {
    const msg: OpenAIChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, msg]);
  }, []);

  const startStreaming = useCallback(() => {
    const id = `streaming-${Date.now()}`;
    streamingIdRef.current = id;
    setIsStreaming(true);
    setMessages((prev) => [
      ...prev,
      {
        id,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        isStreaming: true,
      },
    ]);
  }, []);

  const appendDelta = useCallback((text: string) => {
    const id = streamingIdRef.current;
    if (!id) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content: m.content + text } : m)),
    );
  }, []);

  const endStreaming = useCallback(
    (
      finalContent: string,
      meta?: { provider?: OpenAIProvider; model?: string },
    ) => {
      const id = streamingIdRef.current;
      streamingIdRef.current = null;
      setIsStreaming(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                content: finalContent || m.content,
                isStreaming: false,
                ...meta,
              }
            : m,
        ),
      );
    },
    [],
  );

  const loadHistory = useCallback((history: any[]) => {
    setMessages(
      history.map((m) => ({
        id: m.id ?? Date.now().toString() + Math.random(),
        role: m.role,
        content: m.content,
        provider: m.metadata?.provider,
        model: m.metadata?.model,
        timestamp: m.timestamp ?? new Date().toISOString(),
      })),
    );
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
    setIsStreaming(false);
    streamingIdRef.current = null;
  }, []);

  return {
    messages,
    isStreaming,
    addUserMessage,
    startStreaming,
    appendDelta,
    endStreaming,
    loadHistory,
    clear,
  };
}
