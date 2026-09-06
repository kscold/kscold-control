import { ConflictException } from '@nestjs/common';
import { KeyManagementService } from '@/key-management/application/services/key-management.service';
import { EnvDocumentService } from '@/key-management/application/services/env-document.service';

const currentEnv = `MONGODB_URI=mongodb://mongo:27017/gole
MONGODB_DATABASE=gole
REDIS_HOST=redis
REDIS_PORT=6379
GOLE_ENVIRONMENT=staging
PORTONE_ENABLED=false
`;

function createFixture() {
  const calls: string[] = [];
  const target = {
    id: 'gole-production',
    displayName: 'GoLe Production',
    description: 'GoLe production target',
    environment: 'production',
    provider: 'gcp-secret-manager',
    deploymentProvider: 'github-actions',
    envFileName: 'gole.env',
    instanceName: 'gole-production',
    location: 'GCP zone',
    requiredKeys: [
      'MONGODB_URI',
      'MONGODB_DATABASE',
      'REDIS_HOST',
      'REDIS_PORT',
      'GOLE_ENVIRONMENT',
    ],
    secretConfig: {
      projectId: 'project',
      secretName: 'gole-production-env',
      serviceAccount: 'control@project.iam.gserviceaccount.com',
    },
    deploymentConfig: {
      repository: 'org/repo',
      workflow: 'secret-sync.yml',
      ref: 'main',
    },
    enabled: true,
    sortOrder: 10,
  } as const;
  const targets = {
    get: jest.fn().mockResolvedValue(target),
    list: jest.fn().mockResolvedValue([target]),
  };
  const envDocument = new EnvDocumentService();
  const secretStore = {
    readLatest: jest.fn().mockImplementation(async () => {
      calls.push('read');
      return { version: '1', payload: currentEnv, createdAt: null };
    }),
    readVersion: jest.fn(),
    addVersion: jest.fn().mockImplementation(async () => {
      calls.push('add-version');
      return { version: '2', createdAt: null };
    }),
  };
  const deployments = {
    trigger: jest.fn().mockImplementation(async () => {
      calls.push('deploy');
    }),
    findByRequestId: jest.fn(),
  };
  const backup = {
    id: 'backup-1',
    targetId: 'gole-production',
    operation: 'update',
    sourceVersion: '1',
    newVersion: null,
    checksum: 'checksum',
    changedKeys: ['PORTONE_ENABLED'],
    encryptedPayload: 'ciphertext',
    iv: 'iv',
    authTag: 'tag',
    actorId: '4c39d106-bf07-4c4d-a9bc-19df509ab818',
    actorEmail: 'admin@example.com',
    status: 'backed_up',
    deploymentRequestId: null,
    deploymentRunId: null,
    deploymentUrl: null,
    errorMessage: null,
    restoredFromBackupId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;
  const backups = {
    create: jest.fn().mockImplementation((data) => Object.assign(backup, data)),
    save: jest.fn().mockImplementation(async (value) => {
      calls.push(`db:${value.status}`);
      return value;
    }),
    findRecent: jest.fn().mockResolvedValue([]),
    findByIdWithPayload: jest.fn(),
  };
  const encryption = {
    encrypt: jest.fn().mockReturnValue({
      encryptedPayload: 'ciphertext',
      iv: 'iv',
      authTag: 'tag',
    }),
    decrypt: jest.fn(),
  };
  const service = new KeyManagementService(
    targets as any,
    envDocument,
    encryption as any,
    secretStore as any,
    deployments as any,
    backups as any,
  );

  return { service, secretStore, deployments, backups, calls, target, targets };
}

describe('KeyManagementService', () => {
  const actor = {
    id: '4c39d106-bf07-4c4d-a9bc-19df509ab818',
    email: 'admin@example.com',
  };

  it('DB 사전 백업이 실패하면 Secret Manager와 배포를 건드리지 않는다', async () => {
    const fixture = createFixture();
    fixture.backups.save.mockRejectedValueOnce(
      new Error('database unavailable'),
    );

    await expect(
      fixture.service.updateEnvironment(
        'gole-production',
        currentEnv.replace('PORTONE_ENABLED=false', 'PORTONE_ENABLED=true'),
        '1',
        actor,
      ),
    ).rejects.toThrow('database unavailable');

    expect(fixture.secretStore.addVersion).not.toHaveBeenCalled();
    expect(fixture.deployments.trigger).not.toHaveBeenCalled();
  });

  it('백업 완료 후에만 새 버전을 만들고 배포한다', async () => {
    const fixture = createFixture();

    const result = await fixture.service.updateEnvironment(
      'gole-production',
      currentEnv.replace('PORTONE_ENABLED=false', 'PORTONE_ENABLED=true'),
      '1',
      actor,
    );

    expect(result.version).toBe('2');
    expect(result.changedKeys).toEqual(['PORTONE_ENABLED']);
    expect(fixture.calls.indexOf('db:backed_up')).toBeLessThan(
      fixture.calls.indexOf('add-version'),
    );
    expect(fixture.calls.indexOf('add-version')).toBeLessThan(
      fixture.calls.indexOf('deploy'),
    );
    expect(fixture.secretStore.addVersion).toHaveBeenCalledWith(
      'gole-production',
      expect.stringContaining('PORTONE_ENABLED=true'),
      '1',
    );
  });

  it('expectedVersion 불일치 시 백업과 변경을 시작하지 않는다', async () => {
    const fixture = createFixture();

    await expect(
      fixture.service.updateEnvironment(
        'gole-production',
        currentEnv.replace('PORTONE_ENABLED=false', 'PORTONE_ENABLED=true'),
        '9',
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(fixture.backups.save).not.toHaveBeenCalled();
    expect(fixture.secretStore.addVersion).not.toHaveBeenCalled();
  });

  it('이전 배포가 진행 중이면 같은 대상의 추가 변경을 차단한다', async () => {
    const fixture = createFixture();
    fixture.backups.findRecent.mockResolvedValue([
      {
        id: 'active-backup',
        targetId: 'gole-production',
        status: 'deployment_running',
        deploymentRequestId: '59eaa42f-5270-4b20-a2f0-a3d46845a3bf',
      },
    ]);
    fixture.deployments.findByRequestId.mockResolvedValue(null);

    await expect(
      fixture.service.updateEnvironment(
        'gole-production',
        currentEnv.replace('PORTONE_ENABLED=false', 'PORTONE_ENABLED=true'),
        '1',
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(fixture.secretStore.addVersion).not.toHaveBeenCalled();
  });

  it('재시도 대상보다 최신 Secret 버전이 있으면 이전 버전을 배포하지 않는다', async () => {
    const fixture = createFixture();
    fixture.backups.findByIdWithPayload.mockResolvedValue({
      id: 'backup-1',
      targetId: 'gole-production',
      newVersion: '2',
      status: 'failed',
    });
    fixture.secretStore.readLatest.mockResolvedValue({
      version: '3',
      payload: currentEnv,
      createdAt: null,
    });

    await expect(
      fixture.service.retryDeployment('gole-production', 'backup-1'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(fixture.deployments.trigger).not.toHaveBeenCalled();
  });

  it('대상 설정과 연결 오류의 내부 정보를 API 목록에 노출하지 않는다', async () => {
    const fixture = createFixture();

    const [target] = await fixture.service.listTargets();

    expect(target).toMatchObject({
      id: 'gole-production',
      connectionStatus: 'healthy',
      version: '1',
    });
    expect(target).not.toHaveProperty('secretConfig');
    expect(target).not.toHaveProperty('deploymentConfig');
  });

  it('한 저장소 장애가 다른 운영 대상 목록을 가리지 않는다', async () => {
    const fixture = createFixture();
    const unavailable = {
      ...fixture.target,
      id: 'pawpong-production',
      displayName: 'Pawpong Production',
      provider: 'ssh-env-file',
      deploymentProvider: 'ssh-blue-green',
    } as const;
    fixture.targets.list.mockResolvedValue([fixture.target, unavailable]);
    fixture.secretStore.readLatest.mockImplementation(async (targetId) => {
      if (targetId === unavailable.id) throw new Error('private host detail');
      return { version: '1', payload: currentEnv, createdAt: null };
    });

    const result = await fixture.service.listTargets();

    expect(result).toHaveLength(2);
    expect(result[0].connectionStatus).toBe('healthy');
    expect(result[1]).toMatchObject({
      id: unavailable.id,
      connectionStatus: 'unavailable',
      connectionError: '운영 키 저장소 연결 상태를 확인하지 못했습니다.',
      keys: [],
    });
    expect(JSON.stringify(result)).not.toContain('private host detail');
  });
});
