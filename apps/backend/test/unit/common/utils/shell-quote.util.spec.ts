import { execFileSync } from 'node:child_process';
import { shellQuote } from '@/common/utils/shell-quote.util';

/** 통합 전 docker-log-reader 가 쓰던 이스케이프 방식 */
const legacyBackslashQuote = (value: string): string =>
  `'${value.replace(/'/g, `'\\''`)}'`;

const parseWithShell = (quoted: string): string =>
  execFileSync('/bin/sh', ['-c', `printf %s ${quoted}`], { encoding: 'utf8' });

/** docker-log-reader 처럼 이미 인용된 커맨드를 한 번 더 인용해 넘기는 경우 */
const parseWithNestedShell = (
  quote: (value: string) => string,
  value: string,
): string => {
  const innerCommand = `printf %s ${quote(value)}`;
  return execFileSync('/bin/sh', ['-c', `/bin/sh -c ${quote(innerCommand)}`], {
    encoding: 'utf8',
  });
};

describe('shellQuote', () => {
  const samples = [
    '/var/lib/docker/containers/abc/abc-json.log',
    "/tmp/o'brien/json.log",
    '경로 with space/log.gz',
    '$HOME `whoami` ;rm -rf /',
    "a'b'c",
    "'",
  ];

  it('작은따옴표로 감싸고 내부 작은따옴표를 이스케이프한다', () => {
    expect(shellQuote('plain')).toBe(`'plain'`);
    expect(shellQuote("o'brien")).toBe(`'o'"'"'brien'`);
  });

  it('셸이 원래 값 그대로 되돌려 준다', () => {
    for (const sample of samples) {
      expect(parseWithShell(shellQuote(sample))).toBe(sample);
    }
  });

  it("통합 전 `'\\''` 방식과 셸 해석 결과가 동일하다", () => {
    for (const sample of samples) {
      expect(parseWithShell(shellQuote(sample))).toBe(
        parseWithShell(legacyBackslashQuote(sample)),
      );
    }
  });

  it('중첩 인용(sh -c 안에 다시 인용)에서도 값이 보존되고 두 방식이 같다', () => {
    for (const sample of samples) {
      expect(parseWithNestedShell(shellQuote, sample)).toBe(sample);
      expect(parseWithNestedShell(shellQuote, sample)).toBe(
        parseWithNestedShell(legacyBackslashQuote, sample),
      );
    }
  });
});
