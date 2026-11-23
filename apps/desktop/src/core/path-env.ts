import os from 'node:os';
import path from 'node:path';

/**
 * Finder·시작 메뉴로 켠 앱은 터미널의 PATH 를 물려받지 않아 Homebrew·Docker Desktop 의
 * docker 명령을 못 찾는다. 운영체제별로 흔히 설치되는 위치를 PATH 뒤에 붙인다.
 */
export function withToolPaths(
  currentPath: string | undefined,
  platform: NodeJS.Platform = process.platform,
  home = os.homedir(),
): string {
  const delimiter = platform === 'win32' ? ';' : ':';
  const extra =
    platform === 'darwin'
      ? [
          '/opt/homebrew/bin',
          '/usr/local/bin',
          path.posix.join(home, '.docker', 'bin'),
          '/Applications/Docker.app/Contents/Resources/bin',
        ]
      : platform === 'win32'
        ? ['C:\\Program Files\\Docker\\Docker\\resources\\bin']
        : ['/usr/local/bin', '/usr/bin', '/snap/bin'];
  const parts = (currentPath ?? '').split(delimiter).filter(Boolean);
  for (const candidate of extra) if (!parts.includes(candidate)) parts.push(candidate);
  return parts.join(delimiter);
}
