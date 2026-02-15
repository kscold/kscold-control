import { useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Terminal } from '@xterm/xterm';
import { API_URL, TERMINAL_COLORS } from '../lib/terminal.constants';
import { useModalStore } from '../../../stores/modal.store';

interface UseTerminalSocketProps {
  token: string | null;
  xterm: Terminal | null;
  savedSessionId: string | null;
  onSessionReady: (data: {
    sessionId: string;
    isReconnect: boolean;
  }) => boolean;
  onConnected: () => void;
  onDisconnected: () => void;
  onCommandCount: (count: number, limit: number) => void;
}

/**
 * useTerminalSocket Hook
 * Manages Socket.io connection and event handlers
 *
 * Extracted from ClaudeTerminal.tsx lines 62-143
 */
export function useTerminalSocket({
  token,
  xterm,
  savedSessionId,
  onSessionReady,
  onConnected,
  onDisconnected,
  onCommandCount,
}: UseTerminalSocketProps) {
  const socketRef = useRef<Socket | null>(null);
  const { showAlert } = useModalStore();

  useEffect(() => {
    if (!token || !xterm) return;

    // Socket.io 연결 (JWT 토큰 + 세션 ID 포함)
    const socket = io(`${API_URL}/terminal`, {
      transports: ['websocket'],
      auth: {
        token: token,
        sessionId: savedSessionId,
      },
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      onConnected();
    });

    socket.on('disconnect', () => {
      onDisconnected();
      xterm.writeln(
        `\r\n${TERMINAL_COLORS.yellow}연결이 끊어졌습니다. 재연결 중...${TERMINAL_COLORS.reset}\r\n`,
      );
    });

    // Session ready
    socket.on(
      'terminal:session-ready',
      (data: { sessionId: string; isReconnect: boolean }) => {
        const isReconnect = onSessionReady(data);
        if (isReconnect) {
          xterm.writeln(
            `\r\n${TERMINAL_COLORS.green}세션에 재연결되었습니다${TERMINAL_COLORS.reset}\r\n`,
          );
        }
      },
    );

    // Session history (restored on reconnect)
    socket.on(
      'terminal:history',
      (data: {
        messages: Array<{
          role: 'user' | 'system';
          content: string;
          timestamp: string;
        }>;
      }) => {
        console.log(
          `[Terminal] Restoring ${data.messages.length} messages from history`,
        );

        // Clear terminal first
        xterm.clear();

        // Write history header
        xterm.writeln(
          `${TERMINAL_COLORS.cyan}━━━ 이전 세션 복원됨 ━━━${TERMINAL_COLORS.reset}\r\n`,
        );

        // Replay all messages
        data.messages.forEach((msg) => {
          if (msg.role === 'system') {
            // Output from terminal
            xterm.write(msg.content);
          }
          // User input is already shown in the terminal output, so we don't need to display it separately
        });

        xterm.writeln(
          `${TERMINAL_COLORS.cyan}━━━ 현재 세션 ━━━${TERMINAL_COLORS.reset}\r\n`,
        );
      },
    );

    // Terminal output
    socket.on('terminal:output', (data: { type: string; content: string }) => {
      xterm.write(data.content);
    });

    // Error handling
    socket.on('terminal:error', (data: { message: string }) => {
      xterm.writeln(
        `\r\n${TERMINAL_COLORS.red}에러: ${data.message}${TERMINAL_COLORS.reset}\r\n`,
      );
    });

    // Terminal exit
    socket.on('terminal:exit', (data: { code: number }) => {
      xterm.writeln(
        `\r\n${TERMINAL_COLORS.yellow}터미널 종료 (코드 ${data.code})${TERMINAL_COLORS.reset}\r\n`,
      );
    });

    // Command count updates
    socket.on(
      'terminal:command-count',
      (data: { count: number; limit: number; remaining: number }) => {
        onCommandCount(data.count, data.limit);
        if (data.remaining <= 3 && data.remaining > 0) {
          xterm.writeln(
            `\r\n${TERMINAL_COLORS.yellow}⚠️  남은 명령어: ${data.remaining}회${TERMINAL_COLORS.reset}`,
          );
        }
      },
    );

    // Command limit reached
    socket.on(
      'terminal:limit-reached',
      (data: { limit: number; count: number }) => {
        onCommandCount(data.count, data.limit);
        showAlert(
          `터미널 명령어 제한 (${data.limit}회)에 도달했습니다.\n관리자에게 문의하여 제한을 해제하세요.`,
          '명령어 제한 도달',
        );
      },
    );

    return () => {
      socket.disconnect();
    };
  }, [token, xterm, savedSessionId]);

  /**
   * Send input to terminal
   */
  const sendInput = (data: string) => {
    if (socketRef.current) {
      socketRef.current.emit('terminal:input', { message: data });
    }
  };

  /**
   * Resize terminal
   */
  const resize = (cols: number, rows: number) => {
    if (socketRef.current) {
      socketRef.current.emit('terminal:resize', { cols, rows });
    }
  };

  /**
   * Send interrupt signal (Ctrl+C)
   */
  const interrupt = () => {
    if (socketRef.current) {
      socketRef.current.emit('terminal:interrupt');
    }
  };

  /**
   * Close session
   */
  const closeSession = () => {
    if (socketRef.current) {
      socketRef.current.emit('terminal:close-session');
    }
  };

  /**
   * Clear terminal history (when user types 'clear')
   */
  const clearHistory = () => {
    if (socketRef.current) {
      socketRef.current.emit('terminal:clear-history');
    }
  };

  /**
   * Delete session and history permanently
   */
  const deleteSession = (sessionId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('terminal:delete-session', { sessionId });
    }
  };

  return {
    socket: socketRef.current,
    sendInput,
    resize,
    interrupt,
    closeSession,
    clearHistory,
    deleteSession,
  };
}
