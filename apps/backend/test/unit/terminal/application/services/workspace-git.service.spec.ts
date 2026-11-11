import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { WorkspaceGitService } from '@/terminal/application/services/workspace-git.service';
import { secretNames, withBackendEnv } from '../../../../support/backend-secrets';
import { createFakeAgentCli } from '../../../../support/fake-agent-cli';

describe('WorkspaceGitService child environment', () => {
  withBackendEnv();

  it('runs commands planted in a workspace repo config without backend secrets', async () => {
    const repo = mkdtempSync(path.join(tmpdir(), 'workspace-repo-'));
    const planted = createFakeAgentCli();
    execFileSync('git', ['init', '-q', repo]);
    execFileSync('git', ['-C', repo, 'config', 'core.fsmonitor', planted.binary]);

    const service = new WorkspaceGitService({} as any);
    await service.runGitCommand(['status', '--porcelain'], repo, [0, 128]);

    const env = planted.readEnv();
    expect(env.PATH).toBeDefined();
    expect(secretNames(env)).toEqual([]);
  });
});
