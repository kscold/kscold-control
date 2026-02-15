import { useRef, useEffect } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { TERMINAL_THEME, TERMINAL_FONT } from '../lib/terminal.constants';

interface UseTerminalSetupProps {
  onData: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  onInterrupt: () => void;
}

/**
 * useTerminalSetup Hook
 * Manages XTerm.js initialization and configuration
 *
 * Extracted from ClaudeTerminal.tsx lines 38-59, 134-180
 */
export function useTerminalSetup({
  onData,
  onResize,
  onInterrupt,
}: UseTerminalSetupProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // 화면 크기에 따른 터미널 설정
    const isMobile = window.innerWidth < 768;

    // xterm.js 터미널 생성
    const xterm = new Terminal({
      cursorBlink: true,
      fontSize: isMobile ? TERMINAL_FONT.mobile : TERMINAL_FONT.desktop,
      fontFamily: TERMINAL_FONT.family,
      theme: TERMINAL_THEME,
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

    // 사용자 입력 → PTY로 즉시 전송
    xterm.onData((data) => {
      onData(data);
    });

    // 터미널 리사이즈 이벤트
    xterm.onResize(({ cols, rows }) => {
      onResize(cols, rows);
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
          onInterrupt();
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
      xterm.dispose();
    };
  }, []);

  return {
    terminalRef,
    xterm: xtermRef.current,
    fitAddon: fitAddonRef.current,
  };
}
