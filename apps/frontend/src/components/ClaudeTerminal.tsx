import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { io, Socket } from 'socket.io-client';
import '@xterm/xterm/css/xterm.css';
import { useAuthStore } from '../stores/auth.store';

const API_URL = import.meta.env.VITE_API_URL || '';

interface ClaudeTerminalProps {
  terminalId: string;
}

export function ClaudeTerminal({ terminalId }: ClaudeTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { token } = useAuthStore();

  useEffect(() => {
    if (!terminalRef.current || !token) return;

    // xterm.js 터미널 생성
    const xterm = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cols: 100,
      rows: 30,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
      },
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(terminalRef.current);

    // fitAddon을 비동기로 실행
    setTimeout(() => {
      fitAddon.fit();
    }, 100);

    xtermRef.current = xterm;

    // Socket.io 연결 (JWT 토큰 포함)
    const socket = io(`${API_URL}/terminal`, {
      transports: ['websocket'],
      auth: {
        token: token,
      },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      // PTY 연결 시 자동으로 프롬프트가 표시되므로 별도 메시지 불필요
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      xterm.writeln('\r\n\x1b[31m터미널 연결이 끊어졌습니다\x1b[0m\r\n');
    });

    // 터미널 출력 수신 (PTY에서 오는 모든 출력)
    socket.on('terminal:output', (data: { type: string; content: string }) => {
      xterm.write(data.content);
    });

    socket.on('terminal:error', (data: { message: string }) => {
      xterm.writeln(`\r\n\x1b[31m에러: ${data.message}\x1b[0m\r\n`);
    });

    socket.on('terminal:exit', (data: { code: number }) => {
      xterm.writeln(`\r\n\x1b[33m터미널 종료 (코드 ${data.code})\x1b[0m\r\n`);
    });

    // 사용자 입력 → PTY로 즉시 전송 (모든 키 입력을 그대로 전송)
    xterm.onData((data) => {
      socket.emit('terminal:input', { message: data });
    });

    // 윈도우 리사이즈
    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      socket.disconnect();
      xterm.dispose();
    };
  }, [token, terminalId]);

  const handleClaudeCommand = () => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('terminal:input', { message: 'claude\n' });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-sm text-gray-300">
            {isConnected ? '터미널' : '연결 끊김'}
          </span>
        </div>
        <button
          onClick={handleClaudeCommand}
          disabled={!isConnected}
          className="px-3 py-1.5 text-sm bg-[#D97757] text-white rounded-md hover:bg-[#C86744] disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
        >
          Claude 실행
        </button>
      </div>
      <div ref={terminalRef} className="flex-1 p-4 bg-[#1e1e1e]" />
    </div>
  );
}
