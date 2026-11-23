export type TerminalShellKind = 'zsh' | 'bash' | 'sh' | 'powershell' | 'cmd';

export interface TerminalShell {
  path: string;
  args: string[];
  kind: TerminalShellKind;
}

export interface TerminalShellContext {
  platform: NodeJS.Platform;
  /** 사용자가 직접 고른 셸(TERMINAL_SHELL) */
  override?: string;
  /** 로그인 셸 환경 변수(SHELL) */
  loginShell?: string;
  exists: (filePath: string) => boolean;
}

function kindOf(shellPath: string): TerminalShellKind {
  const name = shellPath.split(/[\\/]/).pop()?.toLowerCase() ?? '';
  if (name.startsWith('pwsh') || name.startsWith('powershell'))
    return 'powershell';
  if (name.startsWith('cmd')) return 'cmd';
  if (name.startsWith('zsh')) return 'zsh';
  if (name.startsWith('bash')) return 'bash';
  return 'sh';
}

function shellFor(shellPath: string): TerminalShell {
  const kind = kindOf(shellPath);
  // 로그인 셸로 띄워야 사용자의 PATH 설정을 읽는다. PowerShell 은 시작 문구만 끈다.
  const args =
    kind === 'powershell' ? ['-NoLogo'] : kind === 'cmd' ? [] : ['-l'];
  return { path: shellPath, args, kind };
}

/**
 * 터미널에서 띄울 셸을 고른다.
 * 1) TERMINAL_SHELL 2) macOS 는 zsh 3) Windows 는 PowerShell 4) 그 밖에는 SHELL → bash → sh
 */
export function resolveTerminalShell(
  context: TerminalShellContext,
): TerminalShell {
  if (context.override?.trim()) return shellFor(context.override.trim());

  if (context.platform === 'win32') {
    return shellFor('powershell.exe');
  }

  const candidates =
    context.platform === 'darwin'
      ? ['/bin/zsh', context.loginShell, '/bin/bash', '/bin/sh']
      : [context.loginShell, '/bin/bash', '/usr/bin/bash', '/bin/sh'];
  const found = candidates.find(
    (candidate): candidate is string =>
      Boolean(candidate) && context.exists(candidate as string),
  );
  return shellFor(found ?? '/bin/sh');
}
