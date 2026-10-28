import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Terminal } from '@xterm/xterm';
import { copyText, readTerminalText } from './terminal-text.utils';

interface FixtureLine {
  text: string;
  isWrapped?: boolean;
}

function fakeTerminal(lines: FixtureLine[]): Terminal {
  return {
    buffer: {
      active: {
        length: lines.length,
        getLine: (index: number) => {
          const line = lines[index];
          return line
            ? {
                isWrapped: line.isWrapped ?? false,
                translateToString: () => line.text,
              }
            : undefined;
        },
      },
    },
  } as unknown as Terminal;
}

describe('터미널 출력 평문 변환', () => {
  it('자동 줄바꿈된 줄은 원래 한 줄로 잇는다', () => {
    const xterm = fakeTerminal([
      { text: '$ echo orca://pair?code=abc' },
      { text: 'def', isWrapped: true },
      { text: 'done' },
    ]);
    expect(readTerminalText(xterm)).toBe(
      '$ echo orca://pair?code=abcdef\ndone',
    );
  });

  it('끝에 남은 빈 줄은 버리고 중간 빈 줄은 유지한다', () => {
    const xterm = fakeTerminal([
      { text: 'a' },
      { text: '' },
      { text: 'b' },
      { text: '' },
      { text: '   ' },
    ]);
    expect(readTerminalText(xterm)).toBe('a\n\nb');
  });
});

describe('클립보드 복사', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('Clipboard API 로 복사한다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(copyText('hello')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('Clipboard API 가 막히면 execCommand 로 대신한다', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      value: execCommand,
      configurable: true,
    });
    await expect(copyText('hello')).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });
});
