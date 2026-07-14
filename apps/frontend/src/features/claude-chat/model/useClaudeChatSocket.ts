import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '../lib/claude-chat.constants';

interface UseClaudeChatSocketOptions {
  token: string | null;
  savedSessionId: string | null;
  onSessionReady: (data: {
    sessionId: string;
    isReconnect: boolean;
    workingDirectory?: string | null;
  }) => void;
  onHistory: (data: { messages: any[] }) => void;
  onMessageStart: () => void;
  onTextDelta: (data: { text: string }) => void;
  onToolUse: (data: { tool: string; input: string; status: string }) => void;
  onMessageEnd: (data: {
    content: string;
    costUsd: number;
    durationMs: number;
    totalCostUsd: number;
  }) => void;
  onError: (data: { message: string }) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onSessionClosed?: () => void;
}

export function useClaudeChatSocket(options: UseClaudeChatSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!options.token) return;

    const socket = io(`${API_URL}/claude-chat`, {
      transports: ['websocket'],
      auth: {
        token: options.token,
        sessionId: options.savedSessionId,
      },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      optionsRef.current.onConnect();
    });

    socket.on('connect_error', (error) => {
      optionsRef.current.onError({
        message: error.message || 'Claude 채팅 서버에 연결할 수 없습니다',
      });
    });

    socket.on('disconnect', () => {
      optionsRef.current.onDisconnect();
    });

    socket.on('claude:session-ready', (data) => {
      optionsRef.current.onSessionReady(data);
    });

    socket.on('claude:history', (data) => {
      optionsRef.current.onHistory(data);
    });

    socket.on('claude:message-start', () => {
      optionsRef.current.onMessageStart();
    });

    socket.on('claude:text-delta', (data) => {
      optionsRef.current.onTextDelta(data);
    });

    socket.on('claude:tool-use', (data) => {
      optionsRef.current.onToolUse(data);
    });

    socket.on('claude:message-end', (data) => {
      optionsRef.current.onMessageEnd(data);
    });

    socket.on('claude:error', (data) => {
      optionsRef.current.onError(data);
    });

    socket.on('claude:session-closed', () => {
      optionsRef.current.onSessionClosed?.();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [options.token, options.savedSessionId]);

  const sendMessage = useCallback((message: string) => {
    if (!socketRef.current?.connected) {
      return false;
    }

    socketRef.current.emit('claude:send-message', { message });
    return true;
  }, []);

  const abort = useCallback(() => {
    socketRef.current?.emit('claude:abort');
  }, []);

  const closeSession = useCallback(() => {
    socketRef.current?.emit('claude:close-session');
  }, []);

  return { sendMessage, abort, closeSession };
}
