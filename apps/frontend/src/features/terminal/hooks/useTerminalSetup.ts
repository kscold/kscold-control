import { useRef, useEffect, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import '@xterm/xterm/css/xterm.css';
import { TERMINAL_THEME, TERMINAL_FONT } from '../lib/terminal.constants';

const MOBILE_BREAKPOINT = 768;
// Claude Code TUI는 80+ cols 를 가정해 그리므로, 모바일에선 cols 를 고정하고
// 컨테이너 가로 스크롤로 처리한다 (FitAddon 으로 폭에 맞추면 박스/테두리가 깨진다).
const MOBILE_FIXED_COLS = 100;

interface UseTerminalSetupProps {
  onData: (data: string) => void;
  onResize: (cols: number, rows: number) => void;
  onInterrupt: () => void;
}

export function useTerminalSetup({
  onData,
  onResize,
  onInterrupt,
}: UseTerminalSetupProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [xtermInstance, setXtermInstance] = useState<Terminal | null>(null);

  // 부모가 매 렌더 새 콜백을 넘겨도 effect 안 옛 클로저가 호출하지 않도록 ref 로 노출
  const handlersRef = useRef({ onData, onResize, onInterrupt });
  handlersRef.current = { onData, onResize, onInterrupt };

  useEffect(() => {
    const container = terminalRef.current;
    if (!container) return;

    let unmounted = false;
    let opened = false;
    const isMobile = () => window.innerWidth < MOBILE_BREAKPOINT;

    const xterm = new Terminal({
      cursorBlink: true,
      fontSize: isMobile() ? TERMINAL_FONT.mobile : TERMINAL_FONT.desktop,
      fontFamily: TERMINAL_FONT.family,
      letterSpacing: 0,
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
    xterm.unicode.activeVersion = '11';

    let fitFrame: number | null = null;
    const scheduleFit = () => {
      if (!opened) return;
      if (fitFrame !== null) {
        window.cancelAnimationFrame(fitFrame);
      }
      fitFrame = window.requestAnimationFrame(() => {
        fitFrame = null;
        if (unmounted) return;
        try {
          if (isMobile()) {
            const proposed = fitAddon.proposeDimensions();
            const rows = proposed?.rows ?? xterm.rows;
            xterm.resize(MOBILE_FIXED_COLS, Math.max(rows, 10));
          } else {
            fitAddon.fit();
          }
        } catch {
          // 컨테이너 측정 전이면 다음 리사이즈에서 재시도
        }
      });
    };

    // 폰트 로드 전에 open 하면 fallback 폰트로 셀 너비를 측정하고 그대로 굳어
    // iOS Safari 에서 글자 간격이 벌어진 것처럼 깨진다. D2Coding 은 실제로 사용되지
    // 않으면 lazy 로드라 명시적으로 로드를 트리거한 뒤 ready 를 기다린다.
    const openTerminal = () => {
      if (unmounted || opened) return;
      opened = true;
      xterm.open(container);
      setXtermInstance(xterm);
      scheduleFit();
    };

    const fontSize = isMobile() ? TERMINAL_FONT.mobile : TERMINAL_FONT.desktop;
    const ensureFonts = document.fonts
      ? Promise.all([
          document.fonts.load(`${fontSize}px "D2Coding"`),
          document.fonts.load(`${fontSize}px "D2Coding"`, '한글'),
          document.fonts.load(`${fontSize}px "JetBrains Mono"`),
        ])
          .catch(() => undefined)
          .then(() => document.fonts.ready)
      : Promise.resolve();

    ensureFonts.then(openTerminal);

    xterm.onSelectionChange(() => {
      const selection = xterm.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection).catch(() => {});
      }
    });

    xterm.onData((data) => handlersRef.current.onData(data));
    xterm.onResize(({ cols, rows }) => handlersRef.current.onResize(cols, rows));

    const handleResize = () => scheduleFit();
    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(scheduleFit);
    resizeObserver.observe(container);

    const pasteFromClipboard = async (e?: KeyboardEvent) => {
      e?.preventDefault();
      try {
        const text = await navigator.clipboard.readText();
        xterm.paste(text);
      } catch {
        // clipboard API 미지원 시 무시
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
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

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const selection = xterm.getSelection();
        if (!selection) {
          e.preventDefault();
          handlersRef.current.onInterrupt();
        }
        return;
      }
    };

    const handlePaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text');
      if (!text) return;
      event.preventDefault();
      xterm.paste(text);
    };

    container.addEventListener('keydown', handleKeyDown, true);
    container.addEventListener('paste', handlePaste);

    return () => {
      unmounted = true;
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      if (fitFrame !== null) {
        window.cancelAnimationFrame(fitFrame);
      }
      container.removeEventListener('keydown', handleKeyDown, true);
      container.removeEventListener('paste', handlePaste);
      xterm.dispose();
    };
  }, []);

  return {
    terminalRef,
    xterm: xtermInstance,
  };
}
