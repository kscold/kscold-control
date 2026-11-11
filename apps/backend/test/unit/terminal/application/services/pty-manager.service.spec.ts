import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as pty from 'node-pty';
import { PtyManagerService } from '@/terminal/application/services/pty-manager.service';
import { secretNames, withBackendEnv } from '../../../../support/backend-secrets';
import { createFakeAgentCli } from '../../../../support/fake-agent-cli';

jest.mock('node-pty', () => ({ spawn: jest.fn(() => ({ kill: jest.fn() })) }));

describe('PtyManagerService shell environment', () => {
  const home = mkdtempSync(path.join(tmpdir(), 'pty-home-'));
  const claude = createFakeAgentCli();
  withBackendEnv({
    HOME: home,
    PATH: '/usr/bin:/bin',
    CLAUDE_WORKING_DIR: home,
    CLAUDE_CODE_BIN: claude.binary,
    CLAUDECODE: '1',
  });

  it('starts the web terminal shell without any backend secret', () => {
    new PtyManagerService().createPty('session-1');

    const [shell, , options] = (pty.spawn as jest.Mock).mock.calls[0];
    const env = options.env as Record<string, string>;
    expect(shell).toBe('/bin/zsh');
    expect(secretNames(env)).toEqual([]);
    expect(env.NODE_ENV).toBeUndefined();
    expect(env.CLAUDECODE).toBeUndefined();
    expect(env).toMatchObject({
      HOME: home,
      SHELL: '/bin/zsh',
      TERM: 'xterm-256color',
      LC_ALL: 'C',
      DOCKER_HOST: 'unix:///tmp/docker-test.sock',
      ZDOTDIR: path.join(home, '.kscold-control-shell'),
      CLAUDE_CODE_BIN: claude.binary,
      PATH: `${path.dirname(claude.binary)}:/usr/bin:/bin`,
    });
  });
});
