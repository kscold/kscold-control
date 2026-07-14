import { useState, useCallback, useRef } from 'react';
import { ChatMessage, ToolUse } from '../model/claude-chat.types';

export function appendUniqueToolUse(
  existingTools: ToolUse[],
  nextTool: ToolUse,
) {
  const hasSameTool = existingTools.some(
    (existing) =>
      existing.tool === nextTool.tool &&
      existing.input === nextTool.input &&
      existing.status === nextTool.status,
  );

  if (hasSameTool) {
    return existingTools;
  }

  return [...existingTools, nextTool];
}

export function completeToolUses(tools: ToolUse[] = []) {
  return tools.map((tool) => ({
    ...tool,
    status: 'end' as const,
  }));
}

export function useClaudeChatMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const toolsRef = useRef<ToolUse[]>([]);

  const addUserMessage = useCallback((content: string) => {
    const msg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, msg]);
  }, []);

  const startStreaming = useCallback(() => {
    toolsRef.current = [];
    const msg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      tools: [],
      timestamp: new Date(),
      isStreaming: true,
    };
    setMessages((prev) => [...prev, msg]);
    setIsStreaming(true);
  }, []);

  const appendDelta = useCallback((text: string) => {
    setMessages((prev) => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last?.role === 'assistant' && last.isStreaming) {
        updated[updated.length - 1] = {
          ...last,
          content: last.content + text,
        };
      }
      return updated;
    });
  }, []);

  const addToolUse = useCallback((tool: ToolUse) => {
    const nextTools = appendUniqueToolUse(toolsRef.current, tool);
    if (nextTools === toolsRef.current) {
      return;
    }

    toolsRef.current = nextTools;
    setMessages((prev) => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last?.role === 'assistant' && last.isStreaming) {
        updated[updated.length - 1] = {
          ...last,
          tools: toolsRef.current,
        };
      }
      return updated;
    });
  }, []);

  const endStreaming = useCallback(
    (data: { content: string; costUsd: number; durationMs: number }) => {
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === 'assistant' && last.isStreaming) {
          updated[updated.length - 1] = {
            ...last,
            content: data.content || last.content,
            tools: completeToolUses(last.tools),
            costUsd: data.costUsd,
            durationMs: data.durationMs,
            isStreaming: false,
          };
        }
        return updated;
      });
      setIsStreaming(false);
      toolsRef.current = [];
    },
    [],
  );

  const loadHistory = useCallback(
    (
      history: Array<{
        role: string;
        content: string;
        metadata?: any;
        timestamp: string;
      }>,
    ) => {
      const loaded: ChatMessage[] = history
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m, i) => ({
          id: `history-${i}`,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          costUsd: m.metadata?.costUsd,
          durationMs: m.metadata?.durationMs,
          timestamp: new Date(m.timestamp),
        }));
      setMessages(loaded);
    },
    [],
  );

  const clear = useCallback(() => {
    setMessages([]);
    setIsStreaming(false);
  }, []);

  return {
    messages,
    isStreaming,
    addUserMessage,
    startStreaming,
    appendDelta,
    addToolUse,
    endStreaming,
    loadHistory,
    clear,
  };
}
