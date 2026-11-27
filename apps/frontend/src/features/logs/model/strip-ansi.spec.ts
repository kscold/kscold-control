import { stripAnsi } from './useLogs';

describe('stripAnsi', () => {
  it('색 코드를 지우고 글자는 남긴다', () => {
    expect(stripAnsi('\u001b[32minfo\u001b[39m [Nest] started')).toBe(
      'info [Nest] started',
    );
  });
});
