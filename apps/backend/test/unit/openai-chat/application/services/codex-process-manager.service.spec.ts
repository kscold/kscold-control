import { CodexProcessManagerService } from '@/openai-chat/application/services/codex-process-manager.service';
import { secretNames, withBackendEnv } from '../../../../support/backend-secrets';
import { createFakeAgentCli, waitForExit } from '../../../../support/fake-agent-cli';

describe('CodexProcessManagerService child environment', () => {
  const cli = createFakeAgentCli();
  withBackendEnv({ CODEX_BIN: cli.binary });

  it('gives the Codex CLI its own API key but no backend secret', async () => {
    const manager = new CodexProcessManagerService();
    await waitForExit((onEvent) =>
      manager.sendPrompt('session-1', 'hello', onEvent),
    );

    const env = cli.readEnv();
    expect(secretNames(env)).toEqual(['OPENAI_API_KEY']);
    expect(env.OPENAI_API_KEY).toBe('test-openai-key');
    expect(env.PATH).toBe(process.env.PATH);
    expect(env.HOME).toBe(process.env.HOME);
  });

  it('does not invent an empty OpenAI key when none is configured', async () => {
    delete process.env.OPENAI_API_KEY;
    const manager = new CodexProcessManagerService();
    await waitForExit((onEvent) =>
      manager.sendPrompt('session-2', 'hello', onEvent),
    );

    expect(secretNames(cli.readEnv())).toEqual([]);
  });
});
