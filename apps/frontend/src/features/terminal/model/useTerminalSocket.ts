import { useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Terminal } from '@xterm/xterm';
import { API_URL, TERMINAL_COLORS } from '../lib/terminal.constants';
import { useModalStore } from '@/shared/model';

interface UseTerminalSocketProps {
  token: string | null;
  xterm: Terminal | null;
  savedSessionId: string | null;
  onSessionReady: (data: {
    sessionId: string;
    isReconnect: boolean;
    workingDirectory?: string | null;
    shellPath?: string | null;
    claudeBinaryPath?: string | null;
    claudeLaunchCommand?: string | null;
  }) => boolean;
  onConnected: () => void;
  onDisconnected: () => void;
  onCommandCount: (count: number, limit: number) => void;
  onOutput?: (content: string) => void;
  onSessionClosed?: () => void;
}

/**
 * Socket.io 연결과 터미널 이벤트 핸들러를 관리하는 훅
 */
export function useTerminalSocket({
  token,
  xterm,
  savedSessionId,
  onSessionReady,
  onConnected,
  onDisconnected,
  onCommandCount,
  onOutput,
  onSessionClosed,
}: UseTerminalSocketProps) {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef({
    onSessionReady,
    onConnected,
    onDisconnected,
    onCommandCount,
    onOutput,
    onSessionClosed,
  });
  handlersRef.current = {
    onSessionReady,
    onConnected,
    onDisconnected,
    onCommandCount,
    onOutput,
    onSessionClosed,
  };
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

    // 연결 관련 이벤트
    socket.on('connect', () => {
      handlersRef.current.onConnected();
    });

    socket.on('disconnect', () => {
      handlersRef.current.onDisconnected();
      xterm.writeln(
        `\r\n${TERMINAL_COLORS.yellow}연결이 끊어졌습니다. 재연결 중...${TERMINAL_COLORS.reset}\r\n`,
      );
    });

    // 세션 준비 완료
    socket.on(
      'terminal:session-ready',
      (data: {
        sessionId: string;
        isReconnect: boolean;
        workingDirectory?: string | null;
        shellPath?: string | null;
        claudeBinaryPath?: string | null;
        claudeLaunchCommand?: string | null;
      }) => {
        const isReconnect = handlersRef.current.onSessionReady(data);
        if (isReconnect) {
          xterm.writeln(
            `\r\n${TERMINAL_COLORS.green}세션에 재연결되었습니다${TERMINAL_COLORS.reset}\r\n`,
          );
        }
      },
    );

    // 세션 히스토리 (재연결 시 복원됨)
    socket.on(
      'terminal:history',
      (data: {
        messages: Array<{
          role: 'user' | 'system';
          content: string;
          timestamp: string;
        }>;
      }) => {
        // 먼저 터미널을 비운다
        xterm.clear();

        // 히스토리 헤더 출력
        xterm.writeln(
          `${TERMINAL_COLORS.cyan}━━━ 이전 세션 복원됨 ━━━${TERMINAL_COLORS.reset}\r\n`,
        );

        // 모든 메시지를 순서대로 다시 출력
        data.messages.forEach((msg) => {
          if (msg.role === 'system') {
            // 터미널에서 나온 출력
            xterm.write(msg.content);
          }
          // 사용자 입력은 이미 터미널 출력에 포함돼 있으므로 따로 표시하지 않는다
        });

        xterm.writeln(
          `\r\n${TERMINAL_COLORS.cyan}━━━ 현재 세션 ━━━${TERMINAL_COLORS.reset}\r\n`,
        );
      },
    );

    // 터미널 출력
    socket.on('terminal:output', (data: { type: string; content: string }) => {
      xterm.write(data.content);
      handlersRef.current.onOutput?.(data.content);
    });

    // 에러 처리
    socket.on('terminal:error', (data: { message: string }) => {
      xterm.writeln(
        `\r\n${TERMINAL_COLORS.red}에러: ${data.message}${TERMINAL_COLORS.reset}\r\n`,
      );
    });

    // 터미널 종료
    socket.on('terminal:exit', (data: { code: number }) => {
      xterm.writeln(
        `\r\n${TERMINAL_COLORS.yellow}터미널 종료 (코드 ${data.code})${TERMINAL_COLORS.reset}\r\n`,
      );
    });

    // 명령어 사용 횟수 갱신
    socket.on(
      'terminal:command-count',
      (data: { count: number; limit: number; remaining: number }) => {
        handlersRef.current.onCommandCount(data.count, data.limit);
        if (data.remaining <= 3 && data.remaining > 0) {
          xterm.writeln(
            `\r\n${TERMINAL_COLORS.yellow}⚠️  남은 명령어: ${data.remaining}회${TERMINAL_COLORS.reset}`,
          );
        }
      },
    );

    // 명령어 사용 제한 도달
    socket.on(
      'terminal:limit-reached',
      (data: { limit: number; count: number }) => {
        handlersRef.current.onCommandCount(data.count, data.limit);
        showAlert(
          `터미널 명령어 제한 (${data.limit}회)에 도달했습니다.\n관리자에게 문의하여 제한을 해제하세요.`,
          '명령어 제한 도달',
        );
      },
    );

    socket.on('terminal:session-closed', () => {
      handlersRef.current.onSessionClosed?.();
    });

    return () => {
      socket.disconnect();
    };
  }, [token, xterm, savedSessionId, showAlert]);

  /**
   * 터미널로 입력을 전송한다
   */
  const sendInput = (data: string) => {
    if (socketRef.current) {
      socketRef.current.emit('terminal:input', { message: data });
    }
  };

  /**
   * 터미널 크기를 조절한다
   */
  const resize = (cols: number, rows: number) => {
    if (socketRef.current) {
      socketRef.current.emit('terminal:resize', { cols, rows });
    }
  };

  /**
   * 인터럽트 시그널(Ctrl+C)을 전송한다
   */
  const interrupt = () => {
    if (socketRef.current) {
      socketRef.current.emit('terminal:interrupt');
    }
  };

  /**
   * 세션을 종료한다
   */
  const closeSession = () => {
    if (socketRef.current) {
      socketRef.current.emit('terminal:close-session');
    }
  };

  /**
   * 터미널 히스토리를 비운다 (사용자가 'clear'를 입력했을 때)
   */
  const clearHistory = () => {
    if (socketRef.current) {
      socketRef.current.emit('terminal:clear-history');
    }
  };

  /**
   * 세션과 히스토리를 영구 삭제한다
   */
  const deleteSession = (sessionId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('terminal:delete-session', { sessionId });
    }
  };

  return {
    sendInput,
    resize,
    interrupt,
    closeSession,
    clearHistory,
    deleteSession,
  };
}
