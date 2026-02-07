import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { io, Socket } from 'socket.io-client';
import '@xterm/xterm/css/xterm.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function ClaudeTerminal() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!terminalRef.current) return;

    // xterm.js 터미널 생성
    const xterm = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
      },
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;

    // Socket.io 연결
    const socket = io(`${API_URL}/claude`, {
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      xterm.writeln('\r\n✅ Claude Code connected\r\n');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      xterm.writeln('\r\n❌ Disconnected from Claude\r\n');
    });

    // Claude 출력 수신
    socket.on('claude:output', (data: { type: string; content: string }) => {
      xterm.write(data.content);
    });

    socket.on('claude:error', (data: { message: string }) => {
      xterm.writeln(`\r\n❌ Error: ${data.message}\r\n`);
    });

    socket.on('claude:exit', (data: { code: number }) => {
      xterm.writeln(`\r\n⚠️  Claude exited with code ${data.code}\r\n`);
    });

    // 사용자 입력 → Claude로 전송
    let inputBuffer = '';
    xterm.onData((data) => {
      if (data === '\r') {
        // Enter
        xterm.write('\r\n');
        socket.emit('claude:input', { message: inputBuffer });
        inputBuffer = '';
      } else if (data === '\u0003') {
        // Ctrl+C
        socket.emit('claude:interrupt');
        inputBuffer = '';
        xterm.write('^C\r\n');
      } else if (data === '\u007F') {
        // Backspace
        if (inputBuffer.length > 0) {
          inputBuffer = inputBuffer.slice(0, -1);
          xterm.write('\b \b');
        }
      } else {
        inputBuffer += data;
        xterm.write(data);
      }
    });

    // 윈도우 리사이즈
    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      socket.disconnect();
      xterm.dispose();
    };
  }, []);

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
            {isConnected ? 'Connected to Claude' : 'Disconnected'}
          </span>
        </div>
      </div>
      <div ref={terminalRef} className="flex-1 p-4 bg-[#1e1e1e]" />
    </div>
  );
}
