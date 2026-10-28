import type { Terminal } from '@xterm/xterm';

/**
 * 터미널 스크롤백 전체를 평문으로 읽는다.
 * 폭 때문에 자동 줄바꿈된 줄(isWrapped)은 원래 한 줄로 이어 붙인다.
 */
export function readTerminalText(xterm: Terminal): string {
  const buffer = xterm.buffer.active;
  const lines: string[] = [];

  for (let i = 0; i < buffer.length; i += 1) {
    const line = buffer.getLine(i);
    if (!line) continue;
    const text = line.translateToString(true);
    if (line.isWrapped && lines.length > 0) {
      lines[lines.length - 1] += text;
    } else {
      lines.push(text);
    }
  }

  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  return lines.join('\n');
}

/**
 * 클립보드에 복사한다. Clipboard API 가 막힌 환경(비보안 컨텍스트, 일부 iOS)에선
 * 임시 textarea 선택 + execCommand 로 대신한다.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  }
}
