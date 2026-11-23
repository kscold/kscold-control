import { describe, expect, it } from 'vitest';
import { withToolPaths } from './path-env';

describe('withToolPaths', () => {
  it('macOS 앱의 짧은 PATH 에 Homebrew·Docker Desktop 위치를 붙인다', () => {
    const result = withToolPaths('/usr/bin:/bin', 'darwin', '/Users/me').split(':');
    expect(result.slice(0, 2)).toEqual(['/usr/bin', '/bin']);
    expect(result).toContain('/opt/homebrew/bin');
    expect(result).toContain('/Users/me/.docker/bin');
  });

  it('이미 있는 위치는 다시 넣지 않는다', () => {
    expect(withToolPaths('/usr/local/bin', 'linux').split(':').filter((p) => p === '/usr/local/bin')).toHaveLength(1);
  });

  it('윈도우는 세미콜론으로 이어 Docker Desktop 위치를 붙인다', () => {
    expect(withToolPaths('C:\\Windows', 'win32')).toBe(
      'C:\\Windows;C:\\Program Files\\Docker\\Docker\\resources\\bin',
    );
  });
});
