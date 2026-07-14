import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { OpenAIProvider } from '../model/openai-chat.types';
import { API_URL } from '../lib/openai-chat.constants';

interface UseOpenAIChatSocketOptions {
  token: string | null;
  provider: OpenAIProvider;
  savedSessionId: string | null;
  onSessionReady: (data: {
    sessionId: string;
    isReconnect: boolean;
    provider: OpenAIProvider;
    model: string;
    apiConfigured: boolean;
  }) => void;
  onHistory: (data: { messages: any[] }) => void;
  onMessageStart: () => void;
  onTextDelta: (data: { text: string }) => void;
  onMessageEnd: (data: {
    content: string;
    provider: OpenAIProvider;
    model?: string;
  }) => void;
  onError: (data: { message: string }) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onSessionClosed?: () => void;
}

export function useOpenAIChatSocket(options: UseOpenAIChatSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!options.token) return;

    const socket = io(`${API_URL}/openai-chat`, {
      transports: ['websocket'],
      auth: {
        token: options.token,
        provider: options.provider,
        sessionId: options.savedSessionId,
      },
    });

    socketRef.current = socket;

    socket.on('connect', () => optionsRef.current.onConnect());
    socket.on('connect_error', (err) =>
      optionsRef.current.onError({
        message: err.message || 'OpenAI 서버에 연결할 수 없습니다',
      }),
    );
    socket.on('disconnect', () => optionsRef.current.onDisconnect());
    socket.on('openai:session-ready', (data) =>
      optionsRef.current.onSessionReady(data),
    );
    socket.on('openai:history', (data) => optionsRef.current.onHistory(data));
    socket.on('openai:message-start', () =>
      optionsRef.current.onMessageStart(),
    );
    socket.on('openai:text-delta', (data) =>
      optionsRef.current.onTextDelta(data),
    );
    socket.on('openai:message-end', (data) =>
      optionsRef.current.onMessageEnd(data),
    );
    socket.on('openai:error', (data) => optionsRef.current.onError(data));
    socket.on('openai:session-closed', () =>
      optionsRef.current.onSessionClosed?.(),
    );

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [options.token, options.provider, options.savedSessionId]);

  const sendMessage = useCallback(
    (message: string) => {
      if (!socketRef.current?.connected) return false;
      socketRef.current.emit('openai:send-message', {
        message,
        provider: options.provider,
      });
      return true;
    },
    [options.provider],
  );

  const abort = useCallback(() => {
    socketRef.current?.emit('openai:abort', { provider: options.provider });
  }, [options.provider]);

  const closeSession = useCallback(() => {
    socketRef.current?.emit('openai:close-session');
  }, []);

  return { sendMessage, abort, closeSession };
}
