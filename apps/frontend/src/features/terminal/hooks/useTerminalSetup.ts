import { useRef, useEffect, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
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
  const fitFrameRef = useRef<number | null>(null);
  // xterm을 state로 노출 → 초기화 완료 시 리렌더 트리거 → 소켓 연결 가능
  const [xtermInstance, setXtermInstance] = useState<Terminal | null>(null);

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
      allowProposedApi: true,
      allowTransparency: true,
      scrollback: 5000,
      rightClickSelectsWord: true,
      macOptionIsMeta: true,
    });

    const fitAddon = new FitAddon();
    const unicode11Addon = new Unicode11Addon();
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(unicode11Addon);
    xterm.unicode.activeVersion = '11'; // Unicode 11 활성화 (한글 2칸 너비)
    xterm.open(terminalRef.current);

    const scheduleFit = () => {
      if (fitFrameRef.current !== null) {
        window.cancelAnimationFrame(fitFrameRef.current);
      }

      fitFrameRef.current = window.requestAnimationFrame(() => {
        fitFrameRef.current = null;

        try {
          fitAddon.fit();
        } catch {
          // terminal container가 아직 숨김/미측정 상태면 다음 리사이즈에서 다시 맞춘다
        }
      });
    };

    window.setTimeout(scheduleFit, 80);
    window.setTimeout(scheduleFit, 220);
    document.fonts?.ready.then(() => {
      scheduleFit();
    });

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;
    setXtermInstance(xterm); // state 업데이트 → 리렌더 → 소켓 연결 트리거

    // 드래그로 텍스트 선택 시 자동 클립보드 복사 (copyOnSelect 대체)
    xterm.onSelectionChange(() => {
      const selection = xterm.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection).catch(() => {});
      }
    });

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
      scheduleFit();
    };
    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      scheduleFit();
    });
    resizeObserver.observe(terminalRef.current);

    // 클립보드에서 읽어 터미널에 붙여넣기
    const pasteFromClipboard = async (e?: KeyboardEvent) => {
      e?.preventDefault();
      try {
        const text = await navigator.clipboard.readText();
        xterm.paste(text);
      } catch {
        // clipboard API 미지원 시 무시
      }
    };

    // 키보드 이벤트 핸들러 (capture: true → 브라우저보다 먼저 실행)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+C (또는 Cmd+Shift+C): 선택 텍스트 복사 (Chrome 가로채기 방지)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === 'c'
      ) {
        e.preventDefault();
        e.stopPropagation();
        const selection = xterm.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection).catch(() => {});
        }
        return;
      }

      // Ctrl+Shift+V (또는 Cmd+Shift+V): 붙여넣기 (브라우저 기본 동작 차단)
      if (
        ((e.ctrlKey || e.metaKey) &&
          e.shiftKey &&
          e.key.toLowerCase() === 'v') ||
        (e.metaKey && e.key.toLowerCase() === 'v')
      ) {
        pasteFromClipboard(e);
        return;
      }

      if (e.shiftKey && e.key === 'Insert') {
        pasteFromClipboard(e);
        return;
      }

      // Ctrl+C (또는 Cmd+C): 선택 없으면 interrupt, 있으면 브라우저 복사 허용
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const selection = xterm.getSelection();
        if (!selection) {
          e.preventDefault();
          onInterrupt();
        }
        return;
      }
    };

    const handlePaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text');
      if (!text) {
        return;
      }

      event.preventDefault();
      xterm.paste(text);
    };

    // capture: true → 브라우저 단축키보다 먼저 실행
    terminalRef.current.addEventListener('keydown', handleKeyDown, true);
    terminalRef.current.addEventListener('paste', handlePaste);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      if (fitFrameRef.current !== null) {
        window.cancelAnimationFrame(fitFrameRef.current);
      }
      terminalRef.current?.removeEventListener('keydown', handleKeyDown, true);
      terminalRef.current?.removeEventListener('paste', handlePaste);
      xterm.dispose();
    };
  }, []);

  return {
    terminalRef,
    xterm: xtermInstance, // ref 대신 state 반환 → 초기화 완료 시 리렌더
    fitAddon: fitAddonRef.current,
  };
}
