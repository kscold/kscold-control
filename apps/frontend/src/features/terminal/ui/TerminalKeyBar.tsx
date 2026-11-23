interface TerminalKeyBarProps {
  disabled: boolean;
  onKey: (sequence: string) => void;
}

// 휴대폰 키보드에 없는 키. Claude·Codex 화면 조작에 자주 쓰는 것만 둔다.
const KEYS: { label: string; aria: string; sequence: string }[] = [
  { label: 'Esc', aria: 'Esc', sequence: '\x1b' },
  { label: 'Tab', aria: 'Tab', sequence: '\t' },
  { label: '⇧Tab', aria: 'Shift Tab', sequence: '\x1b[Z' },
  { label: '^C', aria: 'Ctrl C', sequence: '\x03' },
  { label: '↑', aria: '위', sequence: '\x1b[A' },
  { label: '↓', aria: '아래', sequence: '\x1b[B' },
  { label: '←', aria: '왼쪽', sequence: '\x1b[D' },
  { label: '→', aria: '오른쪽', sequence: '\x1b[C' },
  { label: '⏎', aria: 'Enter', sequence: '\r' },
];

/** 휴대폰에서 터미널 아래에 붙는 특수 키 줄 */
export function TerminalKeyBar({ disabled, onKey }: TerminalKeyBarProps) {
  return (
    <div
      role="toolbar"
      aria-label="특수 키"
      className="flex shrink-0 gap-1 overflow-x-auto border-t border-gray-800 bg-gray-900 px-2 py-1.5 md:hidden"
    >
      {KEYS.map((key) => (
        <button
          key={key.aria}
          type="button"
          aria-label={key.aria}
          disabled={disabled}
          // 버튼이 포커스를 가져가면 휴대폰 키보드가 내려가므로 눌러도 터미널에 포커스를 남긴다.
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => onKey(key.sequence)}
          className="h-9 min-w-11 shrink-0 rounded-md bg-gray-800 px-2.5 font-mono text-sm text-gray-200 active:bg-gray-700 disabled:opacity-40"
        >
          {key.label}
        </button>
      ))}
    </div>
  );
}
