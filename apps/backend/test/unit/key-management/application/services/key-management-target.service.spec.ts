import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { KeyManagementTargetService } from '@/key-management/application/services/key-management-target.service';

const goleTarget = {
  id: 'gole-production',
  displayName: 'GoLe Production',
  description: 'GoLe production target',
  environment: 'production',
  provider: 'gcp-secret-manager',
  deploymentProvider: 'github-actions',
  envFileName: 'gole.env',
  instanceName: 'gole-production',
  location: 'GCP asia-northeast3-a',
  requiredKeys: ['MONGODB_URI'],
  secretConfig: {
    projectId: 'project-72a52bf1-06aa-4519-b2c',
    secretName: 'gole-production-env',
    serviceAccount:
      'kscold-control-secrets@project-72a52bf1-06aa-4519-b2c.iam.gserviceaccount.com',
  },
  deploymentConfig: {
    repository: 'GoLe-by-Colding/GoLe',
    workflow: 'secret-sync.yml',
    ref: 'main',
  },
  enabled: true,
  sortOrder: 10,
} as const;

const pawpongTarget = {
  id: 'pawpong-production',
  displayName: 'Pawpong Production',
  description: 'Pawpong production target',
  environment: 'production',
  provider: 'ssh-env-file',
  deploymentProvider: 'ssh-blue-green',
  envFileName: '.env.production',
  instanceName: 'colding-304515',
  location: '115.68.227.188',
  requiredKeys: ['NODE_ENV', 'JWT_SECRET'],
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

describe('KeyManagementTargetService', () => {
  function fixture(rows = [goleTarget, pawpongTarget]) {
    const repository = {
      findEnabled: jest.fn().mockResolvedValue(rows),
      findEnabledById: jest
        .fn()
        .mockImplementation(async (id: string) =>
          rows.find((row) => row.id === id),
        ),
    };
    return {
      repository,
      service: new KeyManagementTargetService(repository as any),
    };
  }

  it('DB에 활성화된 GoLe와 Pawpong 대상을 순서대로 반환한다', async () => {
    const { service } = fixture();

    const result = await service.list();

    expect(result.map((target) => target.id)).toEqual([
      'gole-production',
      'pawpong-production',
    ]);
    expect(result[1]).toMatchObject({
      provider: 'ssh-env-file',
      deploymentProvider: 'ssh-blue-green',
    });
  });

  it('잘못된 target id는 DB 조회 전에 거절한다', async () => {
    const { service, repository } = fixture();

    await expect(service.get('../pawpong')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repository.findEnabledById).not.toHaveBeenCalled();
  });

  it('저장소와 배포 방식이 잘못 묶인 DB 행을 비활성 상태로 취급한다', async () => {
    const invalid = {
      ...pawpongTarget,
      deploymentProvider: 'github-actions',
      deploymentConfig: goleTarget.deploymentConfig,
    } as const;
    const { service } = fixture([invalid] as any);

    await expect(service.list()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('중복 필수 키가 있는 DB 행을 거절한다', async () => {
    const invalid = {
      ...pawpongTarget,
      requiredKeys: ['NODE_ENV', 'NODE_ENV'],
    };
    const { service } = fixture([invalid] as any);

    await expect(service.list()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
