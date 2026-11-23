import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readLastLines } from '@/common/utils/read-last-lines.util';

const dir = mkdtempSync(path.join(tmpdir(), 'last-lines-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function file(name: string, content: string) {
  const filePath = path.join(dir, name);
  writeFileSync(filePath, content);
  return filePath;
}

describe('readLastLines', () => {
  it('마지막 줄들만 순서대로 돌려준다', async () => {
    expect(
      await readLastLines(file('a.log', 'one\ntwo\nthree\nfour\n'), 2),
    ).toEqual(['three', 'four']);
  });

  it('윈도우 줄바꿈과 빈 줄을 정리한다', async () => {
    expect(await readLastLines(file('b.log', 'a\r\n\r\nb\r\nc'), 5)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('조각 크기보다 큰 파일도 끝부분을 읽는다', async () => {
    const lines = Array.from({ length: 20_000 }, (_, index) => `line-${index}`);
    expect(await readLastLines(file('c.log', lines.join('\n')), 3)).toEqual([
      'line-19997',
      'line-19998',
      'line-19999',
    ]);
  });
});
