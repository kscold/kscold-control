import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Terminal } from '@xterm/xterm';
import { Check, Copy, RefreshCw, X } from 'lucide-react';
import { copyText, readTerminalText } from '../lib/terminal-text.utils';

interface TerminalCopySheetProps {
  xterm: Terminal | null;
}

/**
 * 터미널 출력을 일반 텍스트로 띄워 복사할 수 있게 한다.
 * xterm 캔버스는 모바일에서 길게 눌러 선택이 안 되므로, 평문으로 옮겨
 * 브라우저 기본 선택/복사를 쓰게 한다.
 */
export function TerminalCopySheet({ xterm }: TerminalCopySheetProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const bodyRef = useRef<HTMLPreElement>(null);

  const refresh = () => {
    if (xterm) setText(readTerminalText(xterm));
  };

  const handleOpen = () => {
    refresh();
    setCopied(false);
    setOpen(true);
  };

  const handleCopyAll = async () => {
    const ok = await copyText(text);
    setCopied(ok);
    if (ok) window.setTimeout(() => setCopied(false), 1500);
  };

  // 열 때는 최신 출력이 보이도록 맨 아래로 내린다
  useEffect(() => {
    if (open && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [open, text]);

  // 키보드가 있는 기기에서는 Esc 로 닫는다
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={!xterm}
        aria-label="터미널 출력 복사"
        className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-lg border border-white/15 bg-slate-900/85 px-2.5 py-1.5 text-xs text-slate-200 shadow backdrop-blur transition hover:border-white/30 hover:text-white disabled:opacity-40"
      >
        <Copy size={13} />
        <span>복사</span>
      </button>

      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="터미널 출력"
            className="fixed inset-0 z-50 flex flex-col bg-slate-950 p-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-6"
          >
            <div className="flex items-center justify-between gap-2 pb-2">
              <p className="min-w-0 truncate text-xs text-slate-400">
                길게 눌러 일부만 선택하거나 전체 복사를 누르세요
              </p>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={refresh}
                  aria-label="다시 불러오기"
                  className="inline-flex items-center rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-slate-200"
                >
                  <RefreshCw size={13} />
                </button>
                <button
                  type="button"
                  onClick={handleCopyAll}
                  className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copied ? '복사됨' : '전체 복사'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="닫기"
                  className="inline-flex items-center rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-slate-200"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
            <pre
              ref={bodyRef}
              className="min-h-0 flex-1 select-text overflow-y-auto whitespace-pre-wrap break-all rounded-xl border border-white/10 bg-[#0b1120] p-3 font-mono text-[12px] leading-5 text-slate-200"
            >
              {text || '(출력 없음)'}
            </pre>
          </div>,
          document.body,
        )}
    </>
  );
}
