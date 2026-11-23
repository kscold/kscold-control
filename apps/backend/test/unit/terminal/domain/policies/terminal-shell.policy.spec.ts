import { describe, expect, it } from 'vitest';
import { resolveTerminalShell } from '@/terminal/domain/policies/terminal-shell.policy';

const existing = (paths: string[]) => (filePath: string) =>
  paths.includes(filePath);

describe('resolveTerminalShell', () => {
  it('macOS 는 지금처럼 zsh 로그인 셸을 쓴다', () => {
    expect(
      resolveTerminalShell({
        platform: 'darwin',
        exists: existing(['/bin/zsh']),
      }),
    ).toEqual({
      path: '/bin/zsh',
      args: ['-l'],
      kind: 'zsh',
    });
  });

  it('리눅스는 SHELL 을 먼저 쓰고 없으면 bash, 그것도 없으면 sh 를 쓴다', () => {
    expect(
      resolveTerminalShell({
        platform: 'linux',
        loginShell: '/usr/bin/fish',
        exists: existing(['/usr/bin/fish']),
      }).path,
    ).toBe('/usr/bin/fish');
    expect(
      resolveTerminalShell({
        platform: 'linux',
        exists: existing(['/bin/bash']),
      }).kind,
    ).toBe('bash');
    expect(
      resolveTerminalShell({ platform: 'linux', exists: existing([]) }).path,
    ).toBe('/bin/sh');
  });

  it('윈도우는 PowerShell 을 시작 문구 없이 띄운다', () => {
    expect(
      resolveTerminalShell({ platform: 'win32', exists: existing([]) }),
    ).toEqual({
      path: 'powershell.exe',
      args: ['-NoLogo'],
      kind: 'powershell',
    });
  });

  it('TERMINAL_SHELL 로 고른 셸이 가장 먼저다', () => {
    expect(
      resolveTerminalShell({
        platform: 'win32',
        override: 'C:\\Windows\\System32\\cmd.exe',
        exists: existing([]),
      }),
    ).toEqual({
      path: 'C:\\Windows\\System32\\cmd.exe',
      args: [],
      kind: 'cmd',
    });
  });
});
