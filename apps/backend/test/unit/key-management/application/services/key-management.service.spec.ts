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
    provider: 'gcp-secret-manager',
    projectId: 'project',
    secretName: 'gole-production-env',
    instanceName: 'gole-production',
    zone: 'zone',
    repository: 'org/repo',
    workflow: 'secret-sync.yml',
    ref: 'main',
  } as const;
  const targets = {
    get: jest.fn().mockReturnValue(target),
    list: jest.fn().mockReturnValue([target]),
  };
  const envDocument = new EnvDocumentService({ get: jest.fn() } as any);
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
    findRecent: jest.fn(),
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

  return { service, secretStore, deployments, backups, calls };
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
});
