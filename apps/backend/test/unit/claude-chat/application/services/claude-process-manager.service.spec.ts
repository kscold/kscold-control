import { ClaudeProcessManagerService } from '@/claude-chat/application/services/claude-process-manager.service';
import { secretNames, withBackendEnv } from '../../../../support/backend-secrets';
import { createFakeAgentCli, waitForExit } from '../../../../support/fake-agent-cli';

describe('ClaudeProcessManagerService child environment', () => {
  const cli = createFakeAgentCli();
  withBackendEnv({ CLAUDE_CODE_BIN: cli.binary, CLAUDECODE: '1' });

  it('gives the Claude CLI its own API key but no backend secret', async () => {
    const manager = new ClaudeProcessManagerService();
    await waitForExit((onEvent) =>
      manager.sendPrompt('session-1', 'hello', onEvent),
    );

    const env = cli.readEnv();
    expect(secretNames(env)).toEqual(['ANTHROPIC_API_KEY']);
    expect(env.ANTHROPIC_API_KEY).toBe('test-anthropic-key');
    expect(env.CLAUDECODE).toBeUndefined();
    expect(env.NODE_ENV).toBeUndefined();
    expect(env.HOME).toBe(process.env.HOME);
    expect(env.PATH.split(':')[0]).toBe(require('node:path').dirname(cli.binary));
    expect(env.DOCKER_HOST).toBe('unix:///tmp/docker-test.sock');
  });
});
