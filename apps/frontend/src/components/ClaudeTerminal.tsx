import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { io, Socket } from 'socket.io-client';
import '@xterm/xterm/css/xterm.css';
import { useAuthStore } from '../stores/auth.store';
import { useModalStore } from '../stores/modal.store';

const API_URL = import.meta.env.VITE_API_URL || '';
const SESSION_STORAGE_KEY = 'terminal_session_id';

interface ClaudeTerminalProps {
  terminalId: string;
}

export function ClaudeTerminal({ terminalId }: ClaudeTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [commandCount, setCommandCount] = useState<number>(0);
  const [commandLimit, setCommandLimit] = useState<number>(-1);
  const { token, logout } = useAuthStore();
  const { showConfirm, showAlert } = useModalStore();

  useEffect(() => {
    if (!terminalRef.current || !token) return;

    // 저장된 세션 ID 복구
    const savedSessionId = localStorage.getItem(SESSION_STORAGE_KEY);

    // 화면 크기에 따른 터미널 설정
    const isMobile = window.innerWidth < 768;

    // xterm.js 터미널 생성
    const xterm = new Terminal({
      cursorBlink: true,
      fontSize: isMobile ? 12 : 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
      },
      allowProposedApi: true, // 복사/붙여넣기를 위해 필요
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(terminalRef.current);

    // fitAddon을 비동기로 실행
    setTimeout(() => {
      fitAddon.fit();
    }, 100);

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Socket.io 연결 (JWT 토큰 + 세션 ID 포함)
    const socket = io(`${API_URL}/terminal`, {
      transports: ['websocket'],
      auth: {
        token: token,
        sessionId: savedSessionId, // 재연결을 위한 세션 ID
      },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      xterm.writeln('\r\n\x1b[33m연결이 끊어졌습니다. 재연결 중...\x1b[0m\r\n');
    });

    // 세션 준비 완료
    socket.on(
      'terminal:session-ready',
      (data: { sessionId: string; isReconnect: boolean }) => {
        setSessionId(data.sessionId);
        localStorage.setItem(SESSION_STORAGE_KEY, data.sessionId);

        if (data.isReconnect) {
          xterm.writeln('\r\n\x1b[32m세션에 재연결되었습니다\x1b[0m\r\n');
        }
      },
    );

    // 터미널 출력 수신
    socket.on('terminal:output', (data: { type: string; content: string }) => {
      xterm.write(data.content);
    });

    socket.on('terminal:error', (data: { message: string }) => {
      xterm.writeln(`\r\n\x1b[31m에러: ${data.message}\x1b[0m\r\n`);
    });

    socket.on('terminal:exit', (data: { code: number }) => {
      xterm.writeln(`\r\n\x1b[33m터미널 종료 (코드 ${data.code})\x1b[0m\r\n`);
    });

    // 터미널 명령어 카운트 업데이트
    socket.on(
      'terminal:command-count',
      (data: { count: number; limit: number; remaining: number }) => {
        setCommandCount(data.count);
        setCommandLimit(data.limit);
        if (data.remaining <= 3 && data.remaining > 0) {
          xterm.writeln(
            `\r\n\x1b[33m⚠️  남은 명령어: ${data.remaining}회\x1b[0m`,
          );
        }
      },
    );

    // 터미널 명령어 제한 도달
    socket.on(
      'terminal:limit-reached',
      (data: { limit: number; count: number }) => {
        setCommandCount(data.count);
        setCommandLimit(data.limit);
        showAlert(
          `터미널 명령어 제한 (${data.limit}회)에 도달했습니다.\n관리자에게 문의하여 제한을 해제하세요.`,
          '명령어 제한 도달',
        );
      },
    );

    // 사용자 입력 → PTY로 즉시 전송
    xterm.onData((data) => {
      socket.emit('terminal:input', { message: data });
    });

    // 터미널 리사이즈 이벤트
    xterm.onResize(({ cols, rows }) => {
      socket.emit('terminal:resize', { cols, rows });
    });

    // 윈도우 리사이즈
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    // 키보드 이벤트 핸들러 (Ctrl+C, Ctrl+V 처리)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+C (또는 Cmd+C): 복사 허용 (선택된 텍스트가 있을 때만)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const selection = xterm.getSelection();
        if (selection) {
          // 선택된 텍스트가 있으면 복사 허용
          return;
        } else {
          // 선택된 텍스트가 없으면 Ctrl+C를 터미널에 전송 (interrupt)
          e.preventDefault();
          socket.emit('terminal:interrupt');
        }
      }

      // Ctrl+V (또는 Cmd+V): 붙여넣기
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        // xterm.js가 자동으로 처리하도록 허용
        return;
      }
    };

    terminalRef.current.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleResize);
      terminalRef.current?.removeEventListener('keydown', handleKeyDown);
      socket.disconnect();
      xterm.dispose();
    };
  }, [token, terminalId]);

  const handleClaudeCommand = () => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('terminal:input', { message: 'claude\n' });
    }
  };

  const handleCloseSession = () => {
    showConfirm(
      '현재 터미널 세션을 종료하시겠습니까?\n(진행 중인 작업이 있다면 저장하세요)',
      () => {
        // 백엔드에 세션 종료 요청
        if (socketRef.current) {
          socketRef.current.emit('terminal:close-session');
        }

        // 세션 ID 삭제
        localStorage.removeItem(SESSION_STORAGE_KEY);
        setSessionId(null);

        // 페이지 새로고침하여 새 세션 시작
        setTimeout(() => window.location.reload(), 500);
      },
      '세션 닫기',
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* 터미널 헤더 - 모바일 반응형 */}
      <div className="bg-gray-800 border-b border-gray-700">
        {/* 상태 표시줄 */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-gray-700 sm:border-0">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className="text-xs sm:text-sm text-gray-300">
                {isConnected ? '터미널' : '연결 끊김'}
              </span>
            </div>
            {sessionId && (
              <span className="hidden sm:inline text-xs text-gray-500 font-mono">
                세션: {sessionId.substring(0, 8)}...
              </span>
            )}
            {commandLimit !== -1 && (
              <span
                className={`text-xs font-mono ${
                  commandCount >= commandLimit
                    ? 'text-red-400 font-bold'
                    : commandLimit - commandCount <= 3
                      ? 'text-yellow-400'
                      : 'text-gray-400'
                }`}
              >
                명령어: {commandCount}/{commandLimit}
              </span>
            )}
          </div>
          {/* 모바일: 버튼을 같은 줄에 표시 */}
          <div className="flex gap-1.5 sm:hidden">
            <button
              onClick={handleClaudeCommand}
              disabled={!isConnected}
              className="px-2 py-1 text-xs bg-[#D97757] text-white rounded hover:bg-[#C86744] disabled:opacity-50 transition-all font-medium"
            >
              Claude
            </button>
            <button
              onClick={handleCloseSession}
              disabled={!isConnected}
              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-all font-medium"
            >
              닫기
            </button>
          </div>
        </div>
        {/* 데스크톱: 버튼을 별도 줄에 표시 */}
        <div className="hidden sm:flex items-center justify-end gap-2 px-4 py-2">
          <button
            onClick={handleClaudeCommand}
            disabled={!isConnected}
            className="px-3 py-1.5 text-sm bg-[#D97757] text-white rounded-md hover:bg-[#C86744] disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
          >
            Claude 실행
          </button>
          <button
            onClick={handleCloseSession}
            disabled={!isConnected}
            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
          >
            세션 닫기
          </button>
        </div>
      </div>
      <div ref={terminalRef} className="flex-1 p-2 sm:p-4 bg-[#1e1e1e]" />
    </div>
  );
}
