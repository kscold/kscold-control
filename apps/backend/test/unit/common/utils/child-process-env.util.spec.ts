import { childProcessEnv } from '../../../../src/common/utils/child-process-env.util';
import { BACKEND_SECRETS, secretNames } from '../../../support/backend-secrets';

describe('childProcessEnv', () => {
  const base = {
    ...BACKEND_SECRETS,
    PATH: '/usr/bin:/bin',
    HOME: '/home/operator',
    USER: 'operator',
    LANG: 'ko_KR.UTF-8',
    LC_ALL: 'C',
    TMPDIR: '/tmp/operator',
    DOCKER_HOST: 'unix:///tmp/docker.sock',
    pm_id: '0',
  };

  it('keeps only the shell basics and drops every backend secret', () => {
    expect(childProcessEnv(base)).toEqual({
      PATH: '/usr/bin:/bin',
      HOME: '/home/operator',
      USER: 'operator',
      LANG: 'ko_KR.UTF-8',
      LC_ALL: 'C',
      TMPDIR: '/tmp/operator',
      DOCKER_HOST: 'unix:///tmp/docker.sock',
    });
  });

  it('passes a secret only when the caller names it, and skips unset ones', () => {
    const env = childProcessEnv(base, {
      OPENAI_API_KEY: base.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: undefined,
      HOME: '/tmp/other-home',
    });

    expect(secretNames(env)).toEqual(['OPENAI_API_KEY']);
    expect(env.HOME).toBe('/tmp/other-home');
  });
});
