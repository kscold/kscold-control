// Guacamole 프로토콜 명령은 "길이.값,길이.값,...;" 형식이며 길이는 유니코드 코드 포인트 개수임.
export function encodeInstruction(opcode: string, ...args: string[]): string {
  return `${[opcode, ...args]
    .map((value) => `${[...value].length}.${value}`)
    .join(',')};`;
}

export interface Instruction {
  raw: string;
  opcode: string;
  args: string[];
}

// guacd 출력은 TCP 조각 단위로 오므로 완성된 명령만 꺼냄. 브라우저 터널은 메시지마다 완성된 명령을 기대함.
export class InstructionReader {
  private buffer = '';

  push(chunk: string): Instruction[] {
    this.buffer += chunk;
    const done: Instruction[] = [];
    let start = 0;
    for (;;) {
      const parsed = parse(this.buffer, start);
      if (!parsed) break;
      done.push(parsed.instruction);
      start = parsed.end;
    }
    this.buffer = this.buffer.slice(start);
    if (this.buffer.length > 8 * 1024 * 1024)
      throw new Error('Guacamole instruction too large');
    return done;
  }
}

function parse(
  text: string,
  start: number,
): { instruction: Instruction; end: number } | null {
  const elements: string[] = [];
  let index = start;
  for (;;) {
    const dot = text.indexOf('.', index);
    if (dot === -1) return null;
    const lengthText = text.slice(index, dot);
    if (!/^\d{1,10}$/.test(lengthText))
      throw new Error('Malformed Guacamole instruction');
    let remaining = Number(lengthText);
    let cursor = dot + 1;
    while (remaining > 0 && cursor < text.length) {
      const code = text.codePointAt(cursor)!;
      cursor += code > 0xffff ? 2 : 1;
      remaining -= 1;
    }
    if (remaining > 0 || cursor >= text.length) return null;
    elements.push(text.slice(dot + 1, cursor));
    const terminator = text[cursor];
    if (terminator === ';') {
      const [opcode, ...args] = elements;
      return {
        instruction: { raw: text.slice(start, cursor + 1), opcode, args },
        end: cursor + 1,
      };
    }
    if (terminator !== ',') throw new Error('Malformed Guacamole instruction');
    index = cursor + 1;
  }
}

export interface RdpParameters {
  hostname: string;
  port: number;
  username?: string;
  password?: string;
}

// 메모리를 아끼려고 16비트 색, 소리·배경화면 끔. 크기는 연결 뒤 브라우저가 display-update 로 맞춤.
export function rdpConnectValues(
  argNames: string[],
  target: RdpParameters,
): string[] {
  const values: Record<string, string> = {
    hostname: target.hostname,
    port: String(target.port),
    username: target.username ?? '',
    password: target.password ?? '',
    security: 'any',
    'ignore-cert': 'true',
    'resize-method': 'display-update',
    'enable-wallpaper': 'false',
    'color-depth': '16',
    'disable-audio': 'true',
  };
  return argNames.map((name) =>
    name.startsWith('VERSION_') ? name : (values[name] ?? ''),
  );
}

export function rdpHandshake(argNames: string[], target: RdpParameters) {
  return [
    encodeInstruction('size', '1280', '720', '96'),
    encodeInstruction('audio'),
    encodeInstruction('video'),
    encodeInstruction('image', 'image/png', 'image/jpeg', 'image/webp'),
    encodeInstruction('connect', ...rdpConnectValues(argNames, target)),
  ].join('');
}
