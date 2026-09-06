import { ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { SshEnvFileSecretStoreGateway } from '@/key-management/infrastructure/gateways/ssh-env-file-secret-store.gateway';

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

function checksum(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function fixture() {
  const targets = { get: jest.fn().mockResolvedValue(target) };
  const ssh = { execute: jest.fn() };
  const gateway = new SshEnvFileSecretStoreGateway(targets as any, ssh as any);
  return { gateway, ssh };
}

describe('SshEnvFileSecretStoreGateway', () => {
  const current = 'NODE_ENV=production\nJWT_SECRET=old-value\n';
  const next = 'NODE_ENV=production\nJWT_SECRET=next-sensitive-value\n';

  it('원격 env 파일 본문으로 변경 불가능한 체크섬 버전을 만든다', async () => {
    const { gateway, ssh } = fixture();
    ssh.execute.mockResolvedValue(`1788670000\n${current}`);

    const result = await gateway.readLatest(target.id);

    expect(result).toEqual({
      version: checksum(current),
      payload: current,
      createdAt: new Date(1788670000 * 1_000).toISOString(),
    });
  });

  it('민감한 본문은 명령행이 아니라 stdin으로 보내고 원격 무결성을 확인한다', async () => {
    const { gateway, ssh } = fixture();
    const desired = checksum(next);
    ssh.execute.mockResolvedValue(`1788670001|${desired}\n`);

    const result = await gateway.addVersion(target.id, next, checksum(current));

    expect(result.version).toBe(desired);
    const [, command, options] = ssh.execute.mock.calls[0];
    expect(command).not.toContain('next-sensitive-value');
    expect(command).toContain('flock -w 15');
    expect(command).toContain('chmod 600');
    expect(options.input).toBe(next);
  });

  it('응답이 끊겨도 원격 파일이 원하는 체크섬이면 성공으로 복구한다', async () => {
    const { gateway, ssh } = fixture();
    ssh.execute
      .mockRejectedValueOnce(new Error('connection dropped'))
      .mockResolvedValueOnce(`1788670002\n${next}`);

    const result = await gateway.addVersion(target.id, next, checksum(current));

    expect(result.version).toBe(checksum(next));
  });

  it('CAS 검사 중 다른 값이 감지되면 덮어쓰기 충돌로 반환한다', async () => {
    const { gateway, ssh } = fixture();
    const external = 'NODE_ENV=production\nJWT_SECRET=external-value\n';
    ssh.execute
      .mockRejectedValueOnce(new Error('exit 73'))
      .mockResolvedValueOnce(`1788670003\n${external}`);

    await expect(
      gateway.addVersion(target.id, next, checksum(current)),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
