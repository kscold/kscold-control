import { describe, expect, it } from 'vitest';
import { EMPTY_TARGET_FORM, toTargetInput } from './target-form';

const form = {
  ...EMPTY_TARGET_FORM,
  id: 'shop-production',
  displayName: '쇼핑몰 운영',
  requiredKeys: 'NODE_ENV, DATABASE_URL\nJWT_SECRET',
  host: 'deploy.example.com',
  port: '2222',
  username: 'deploy',
  credentialRef: 'shop-deploy',
};

describe('toTargetInput', () => {
  it('SSH 명령 대상은 env-v1 설정과 쉼표·줄바꿈으로 나눈 키를 만든다', () => {
    const input = toTargetInput('ssh-command', form);
    expect(input).toMatchObject({
      provider: 'ssh-env-command',
      deploymentProvider: 'ssh-env-command',
      requiredKeys: ['NODE_ENV', 'DATABASE_URL', 'JWT_SECRET'],
      secretConfig: { port: 2222, protocol: 'env-v1', allowedKeys: ['*'] },
      deploymentConfig: { protocol: 'env-v1' },
      // 비운 칸은 이름·ID·호스트로 채운다
      description: '쇼핑몰 운영',
      instanceName: 'shop-production',
      location: 'deploy.example.com',
    });
  });

  it('GCP 대상은 GitHub Actions 배포와 짝을 맞춘다', () => {
    const input = toTargetInput('gcp', {
      ...form,
      projectId: 'demo-project',
      secretName: 'shop-env',
      serviceAccount: 'svc@demo-project.iam.gserviceaccount.com',
      repository: 'example/shop',
    });
    expect(input.provider).toBe('gcp-secret-manager');
    expect(input.deploymentProvider).toBe('github-actions');
    expect(input.secretConfig).not.toHaveProperty('host');
  });
});
