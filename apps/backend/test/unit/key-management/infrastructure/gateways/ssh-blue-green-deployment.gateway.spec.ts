import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { SshBlueGreenDeploymentGateway } from '@/key-management/infrastructure/gateways/ssh-blue-green-deployment.gateway';

const target = {
  id: 'pawpong-production',
  displayName: 'Pawpong Production',
  description: 'Pawpong production target',
  environment: 'production',
  provider: 'ssh-env-file',
  deploymentProvider: 'ssh-blue-green',
  envFileName: '.env.production',
  instanceName: 'colding-304515',
  location: '115.68.227.188',
  requiredKeys: ['NODE_ENV'],
  secretConfig: {
    host: '115.68.227.188',
    port: 22,
    username: 'colding',
    envPath: '/home/colding/pawpong_backend/.env.production',
    credentialRef: 'pawpong-production',
  },
  deploymentConfig: {
    workingDirectory: '/home/colding/pawpong_backend',
    script: 'deploy.sh',
    statusDirectory:
      '/home/colding/pawpong_backend/.kscold-control/deployments',
  },
  enabled: true,
  sortOrder: 20,
} as const;

function fixture() {
  const targets = { get: jest.fn().mockResolvedValue(target) };
  const ssh = { execute: jest.fn() };
  return {
    ssh,
    gateway: new SshBlueGreenDeploymentGateway(targets as any, ssh as any),
  };
}

describe('SshBlueGreenDeploymentGateway', () => {
  it('배포를 백그라운드 작업으로 시작하고 상태 파일 경로를 요청별로 격리한다', async () => {
    const { gateway, ssh } = fixture();
    const requestId = randomUUID();
    ssh.execute.mockResolvedValue('43120\n');

    await gateway.trigger({
      targetId: target.id,
      version: 'a'.repeat(64),
      requestId,
    });

    const [, command] = ssh.execute.mock.calls[0];
    expect(command).toContain(`${requestId}.state`);
    expect(command).toContain('nohup sh -c');
    expect(command).toContain('deploy.sh');
    expect(spawnSync('/bin/sh', ['-n', '-c', command]).status).toBe(0);
  });

  it.each([
    ['queued', 'queued'],
    ['running', 'running'],
    ['succeeded', 'succeeded'],
    ['failed', 'failed'],
  ] as const)(
    '원격 %s 상태를 표준 배포 상태로 반환한다',
    async (raw, expected) => {
      const { gateway, ssh } = fixture();
      const requestId = randomUUID();
      const started = Math.floor(Date.now() / 1_000) - 10;
      ssh.execute.mockResolvedValue(`${raw}|${started}|${started + 5}\n`);

      const result = await gateway.findByRequestId(target.id, requestId);

      expect(result).toMatchObject({ requestId, state: expected });
    },
  );

  it('15분 넘게 갱신되지 않은 실행 상태를 timeout 실패로 판정한다', async () => {
    const { gateway, ssh } = fixture();
    const requestId = randomUUID();
    const staleStarted = Math.floor(Date.now() / 1_000) - 16 * 60;
    ssh.execute.mockResolvedValue(`running|${staleStarted}|\n`);

    const result = await gateway.findByRequestId(target.id, requestId);

    expect(result).toMatchObject({ state: 'failed', conclusion: 'timeout' });
  });
});
