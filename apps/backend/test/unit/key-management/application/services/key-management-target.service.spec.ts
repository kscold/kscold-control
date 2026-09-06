import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { KeyManagementTargetService } from '@/key-management/application/services/key-management-target.service';

const projectalphaTarget = {
  id: 'projectalpha-production',
  displayName: 'ProjectAlpha Production',
  description: 'ProjectAlpha production target',
  environment: 'production',
  provider: 'gcp-secret-manager',
  deploymentProvider: 'github-actions',
  envFileName: 'projectalpha.env',
  instanceName: 'projectalpha-production',
  location: 'GCP asia-northeast3-a',
  requiredKeys: ['MONGODB_URI'],
  secretConfig: {
    projectId: 'example-project',
    secretName: 'projectalpha-production-env',
    serviceAccount:
      'kscold-control-secrets@example-project.iam.gserviceaccount.com',
  },
  deploymentConfig: {
    repository: 'example-org/projectalpha',
    workflow: 'secret-sync.yml',
    ref: 'main',
  },
  enabled: true,
  sortOrder: 10,
} as const;

const projectbetaTarget = {
  id: 'projectbeta-production',
  displayName: 'ProjectBeta Production',
  description: 'ProjectBeta production target',
  environment: 'production',
  provider: 'ssh-env-file',
  deploymentProvider: 'ssh-blue-green',
  envFileName: '.env.production',
  instanceName: 'example-instance',
  location: '192.0.2.10',
  requiredKeys: ['NODE_ENV', 'JWT_SECRET'],
  secretConfig: {
    host: '192.0.2.10',
    port: 22,
    username: 'deploy',
    envPath: '/home/deploy/projectbeta_backend/.env.production',
    credentialRef: 'projectbeta-production',
  },
  deploymentConfig: {
    workingDirectory: '/home/deploy/projectbeta_backend',
    script: 'deploy.sh',
    statusDirectory:
      '/home/deploy/projectbeta_backend/.kscold-control/deployments',
  },
  enabled: true,
  sortOrder: 20,
} as const;

describe('KeyManagementTargetService', () => {
  function fixture(rows = [projectalphaTarget, projectbetaTarget]) {
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

  it('DB에 활성화된 ProjectAlpha와 ProjectBeta 대상을 순서대로 반환한다', async () => {
    const { service } = fixture();

    const result = await service.list();

    expect(result.map((target) => target.id)).toEqual([
      'projectalpha-production',
      'projectbeta-production',
    ]);
    expect(result[1]).toMatchObject({
      provider: 'ssh-env-file',
      deploymentProvider: 'ssh-blue-green',
    });
  });

  it('잘못된 target id는 DB 조회 전에 거절한다', async () => {
    const { service, repository } = fixture();

    await expect(service.get('../projectbeta')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repository.findEnabledById).not.toHaveBeenCalled();
  });

  it('저장소와 배포 방식이 잘못 묶인 DB 행을 비활성 상태로 취급한다', async () => {
    const invalid = {
      ...projectbetaTarget,
      deploymentProvider: 'github-actions',
      deploymentConfig: projectalphaTarget.deploymentConfig,
    } as const;
    const { service } = fixture([invalid] as any);

    await expect(service.list()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('중복 필수 키가 있는 DB 행을 거절한다', async () => {
    const invalid = {
      ...projectbetaTarget,
      requiredKeys: ['NODE_ENV', 'NODE_ENV'],
    };
    const { service } = fixture([invalid] as any);

    await expect(service.list()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
