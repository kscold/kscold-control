import { open } from 'node:fs/promises';

const CHUNK_SIZE = 64 * 1024;

/**
 * 파일 끝에서 마지막 줄들을 읽음. tail 명령이 없는 윈도우에서도 같게 동작하고,
 * 큰 로그 파일도 끝부분만 조각으로 읽는다.
 */
export async function readLastLines(
  filePath: string,
  lineCount: number,
): Promise<string[]> {
  if (lineCount <= 0) return [];
  const handle = await open(filePath, 'r');
  try {
    const { size } = await handle.stat();
    const chunks: Buffer[] = [];
    let position = size;
    let newlines = 0;
    // 마지막 줄 뒤 줄바꿈까지 감안해 한 줄 더 모일 때까지 거꾸로 읽는다.
    while (position > 0 && newlines <= lineCount) {
      const length = Math.min(CHUNK_SIZE, position);
      position -= length;
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, position);
      chunks.unshift(buffer);
      for (const byte of buffer) if (byte === 0x0a) newlines += 1;
    }
    return Buffer.concat(chunks)
      .toString('utf8')
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .slice(-lineCount);
  } finally {
    await handle.close();
  }
}
