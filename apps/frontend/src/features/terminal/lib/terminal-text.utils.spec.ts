import { describe, expect, it } from 'vitest';
import type { Terminal } from '@xterm/xterm';
import { readTerminalText } from './terminal-text.utils';

function fakeTerminal(lines: Array<{ text: string; isWrapped?: boolean }>) {
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

describe('readTerminalText', () => {
  it('화면 폭 때문에 줄바꿈된 줄은 원래 한 줄로 합친다', () => {
    const xterm = fakeTerminal([
      { text: '$ echo orca://pair?code=abc' },
      { text: 'def', isWrapped: true },
      { text: 'done' },
    ]);

    expect(readTerminalText(xterm)).toBe(
      '$ echo orca://pair?code=abcdef\ndone',
    );
  });

  it('끝에 남은 빈 줄은 버린다', () => {
    const xterm = fakeTerminal([
      { text: 'hello' },
      { text: '' },
      { text: ' ' },
    ]);

    expect(readTerminalText(xterm)).toBe('hello');
  });
});
