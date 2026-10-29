import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { SecretEncryptionService } from '@/common/crypto/secret-encryption.service';
import { EnvDocumentService } from '@/key-management/application/services/env-document.service';
import { KeyManagementService } from '@/key-management/application/services/key-management.service';
import { KeyManagementTargetAccessGuard } from '@/key-management/presentation/guards/key-management-target-access.guard';
import { KeyManagementController } from '@/key-management/presentation/controllers/key-management.controller';
import { AUDIT_KEY } from '@/common/decorators';
import { PERMISSIONS } from '@/common/constants/permissions';
import { DeploymentRejectedError } from '@/key-management/domain/gateways/deployment.gateway.interface';
import { SshEnvCommandGateway } from '@/key-management/infrastructure/gateways/ssh-env-command.gateway';

const original =
  'MINIO_ACCESS_KEY=synthetic-access\nMINIO_SECRET_KEY=synthetic-old\nMINIO_ENDPOINT=http://127.0.0.1:9000\nMINIO_BUCKET=storage-test\n';
const desired = original.replace('synthetic-old', 'synthetic-new');
const sha = (payload: string) =>
  createHash('sha256').update(payload).digest('hex');
const actor = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'admin@example.test',
};
const requestId = '11111111-1111-4111-8111-111111111111';

function fixture() {
  let payload = original;
  const calls: string[] = [];
  const rows: any[] = [];
  const target = {
    id: 'storage-production',
    provider: 'ssh-env-command',
    deploymentProvider: 'ssh-env-command',
    requiredKeys: [
      'MINIO_ACCESS_KEY',
      'MINIO_SECRET_KEY',
      'MINIO_ENDPOINT',
      'MINIO_BUCKET',
    ],
    secretConfig: {
      allowedKeys: [
        'MINIO_ACCESS_KEY',
        'MINIO_SECRET_KEY',
        'MINIO_ENDPOINT',
        'MINIO_BUCKET',
      ],
    },
  };
  const encryption = new SecretEncryptionService(
    new ConfigService({
      KEY_MANAGEMENT_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    }),
  );
  const store = {
    readLatest: jest.fn(async () => ({
      version: sha(payload),
      payload,
      createdAt: null,
    })),
    addVersion: jest.fn(async (_id: string, next: string) => {
      calls.push('write');
      payload = next;
      return { version: sha(payload), createdAt: null };
    }),
  };
  const backups = {
    create: jest.fn((data) => ({ id: `backup-${rows.length + 1}`, ...data })),
    save: jest.fn(async (row) => {
      calls.push(`save:${row.status}`);
      const index = rows.findIndex((saved) => saved.id === row.id);
      if (index < 0) rows.push({ ...row });
      else rows[index] = { ...row };
      return row;
    }),
    findRecent: jest.fn(async () => rows.map((row) => ({ ...row }))),
    findByIdWithPayload: jest.fn(async (id) => {
      const row = rows.find((row) => row.id === id);
      return row ? { ...row } : undefined;
    }),
  };
  const deployments = {
    trigger: jest.fn(async (_input: any) => {
      calls.push('apply');
    }),
    findByRequestId: jest.fn(async (_id, requestId) => ({
      requestId,
      runId: requestId,
      state: 'succeeded',
      conclusion: 'success',
      url: null,
      createdAt: null,
      updatedAt: null,
    })),
  };
  const service = new KeyManagementService(
    {
      get: jest.fn(async () => target),
      list: jest.fn(async () => [target]),
    } as any,
    new EnvDocumentService(),
    encryption,
    store as any,
    deployments as any,
    backups as any,
  );
  return {
    service,
    target,
    store,
    encryption,
    backups,
    deployments,
    rows,
    calls,
    payload: () => payload,
  };
}

describe('forced command 환경의 암호화 백업·복원', () => {
  it.each(['encryption', 'database'])(
    '%s 사전 백업 실패는 서버 쓰기와 적용을 차단한다',
    async (failure) => {
      const f = fixture();
      if (failure === 'encryption')
        jest.spyOn(f.encryption, 'encrypt').mockImplementation(() => {
          throw new Error('synthetic failure');
        });
      else f.backups.save.mockRejectedValueOnce(new Error('synthetic failure'));
      await expect(
        f.service.updateEnvironment(f.target.id, desired, sha(original), actor),
      ).rejects.toThrow('synthetic failure');
      expect(f.store.addVersion).not.toHaveBeenCalled();
      expect(f.deployments.trigger).not.toHaveBeenCalled();
      expect(f.payload()).toBe(original);
    },
  );

  it('원본을 대상과 버전에 묶어 암호화한 후 쓰고 적용 요청을 기록한다', async () => {
    const f = fixture();
    const result = await f.service.updateEnvironment(
      f.target.id,
      desired,
      sha(original),
      actor,
    );
    const row = f.rows[0];
    expect(f.calls.indexOf('save:backed_up')).toBeLessThan(
      f.calls.indexOf('write'),
    );
    expect(f.calls.indexOf('write')).toBeLessThan(f.calls.indexOf('apply'));
    expect(JSON.stringify(row)).not.toContain('synthetic-old');
    expect(
      f.encryption.decrypt(
        row.encryptedPayload,
        row.iv,
        row.authTag,
        `${f.target.id}:${sha(original)}`,
      ),
    ).toBe(original);
    expect(result.changedKeys).toEqual(['MINIO_SECRET_KEY']);
    expect(f.deployments.trigger).toHaveBeenCalledWith({
      targetId: f.target.id,
      version: sha(desired),
      requestId: expect.stringMatching(/^[a-f0-9-]{36}$/),
    });
  });

  it('복원 시 현재 원본도 새 암호화 백업으로 남기고 공개 이력에는 비밀을 싣지 않는다', async () => {
    const f = fixture();
    const first = await f.service.updateEnvironment(
      f.target.id,
      desired,
      sha(original),
      actor,
    );
    const restored = await f.service.restore(
      f.target.id,
      first.backupId,
      sha(desired),
      actor,
    );
    expect(restored.version).toBe(sha(original));
    expect(f.payload()).toBe(original);
    const second = f.rows[1];
    expect(second).toMatchObject({
      operation: 'restore',
      sourceVersion: sha(desired),
      restoredFromBackupId: first.backupId,
    });
    expect(
      f.encryption.decrypt(
        second.encryptedPayload,
        second.iv,
        second.authTag,
        `${f.target.id}:${sha(desired)}`,
      ),
    ).toBe(desired);
    const ledger = JSON.stringify(await f.service.listBackups(f.target.id));
    expect(ledger).not.toMatch(/synthetic|encryptedPayload|authTag|"iv"/);
    expect((await f.service.listBackups(f.target.id))[1].status).toBe(
      'deployed',
    );
  });

  it('다른 대상의 암호문을 옮겨 붙인 복원은 쓰기 전에 거절한다', async () => {
    const f = fixture();
    const encrypted = f.encryption.encrypt(
      original,
      `other-production:${sha(original)}`,
    );
    f.rows.push({
      id: 'tampered',
      targetId: f.target.id,
      sourceVersion: sha(original),
      ...encrypted,
    });
    await expect(
      f.service.restore(f.target.id, 'tampered', sha(original), actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(f.store.addVersion).not.toHaveBeenCalled();
  });

  it('서버 권한 거절은 원본과 암호화 백업을 보존하고 적용을 시작하지 않는다', async () => {
    const f = fixture();
    f.store.addVersion.mockRejectedValueOnce(
      new Error('synthetic-private-detail'),
    );
    await expect(
      f.service.updateEnvironment(f.target.id, desired, sha(original), actor),
    ).rejects.toThrow();
    expect(f.rows[0].status).toBe('failed');
    expect(f.rows[0].errorMessage).not.toContain('synthetic-private-detail');
    expect(f.payload()).toBe(original);
    expect(f.deployments.trigger).not.toHaveBeenCalled();
  });
});

describe('원격 적용 전 UUID 의도 저장과 불명 응답 복구', () => {
  function disconnectedGateway(f: ReturnType<typeof fixture>) {
    let connected = false;
    let remote: any = null;
    const ssh = {
      execute: jest.fn(async (_target, command: string) => {
        if (command.startsWith('env-v1 apply ')) {
          const [, , requestId, version] = command.split(' ');
          expect(f.rows[0].deploymentRequestId).toBe(requestId);
          expect(f.rows[0].status).toBe('deployment_queued');
          remote = {
            requestId,
            version,
            revision: 'a'.repeat(40),
            state: 'running',
            conclusion: null,
            createdAt: '2026-10-28T09:00:00.000Z',
            updatedAt: '2026-10-28T09:00:01.000Z',
          };
          throw new Error('synthetic lost apply acknowledgement');
        }
        if (!connected) throw new Error('synthetic status outage');
        return JSON.stringify({ protocol: 'env-v1', ok: true, record: remote });
      }),
    };
    const gateway = new SshEnvCommandGateway(
      { get: jest.fn(async () => f.target) } as any,
      ssh as any,
      new EnvDocumentService(),
    );
    f.deployments.trigger.mockImplementation(async (input) =>
      gateway.trigger(input),
    );
    f.deployments.findByRequestId.mockImplementation(
      async (id, requestId) => gateway.findByRequestId(id, requestId) as any,
    );
    return {
      ssh,
      reconnect: () => {
        connected = true;
      },
      remote: () => remote,
      appliedCount: () =>
        ssh.execute.mock.calls.filter(([, command]) =>
          command.startsWith('env-v1 apply '),
        ).length,
    };
  }

  it('apply accepted 후 ack/status가 모두 끊겨도 같은 UUID를 보존하고 연결 회복 후 추적한다', async () => {
    const f = fixture();
    const network = disconnectedGateway(f);
    const result = await f.service.updateEnvironment(
      f.target.id,
      desired,
      sha(original),
      actor,
    );
    expect(f.rows[0]).toMatchObject({
      deploymentRequestId: result.deployment.requestId,
      status: 'deployment_queued',
      newVersion: sha(desired),
    });
    expect(network.remote().requestId).toBe(result.deployment.requestId);
    expect((await f.service.listBackups(f.target.id))[0].status).toBe(
      'deployment_queued',
    );
    await expect(
      f.service.retryDeployment(f.target.id, result.backupId),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(network.appliedCount()).toBe(1);
    network.reconnect();
    expect((await f.service.listBackups(f.target.id))[0]).toMatchObject({
      status: 'deployment_running',
      deploymentRequestId: result.deployment.requestId,
    });
    network.remote().state = 'succeeded';
    network.remote().conclusion = 'success';
    expect((await f.service.listBackups(f.target.id))[0]).toMatchObject({
      status: 'deployed',
      deploymentRequestId: result.deployment.requestId,
    });
    expect(network.appliedCount()).toBe(1);
  });

  it('retry도 전송 전 UUID를 저장하며 불명 응답을 확정 실패로 바꾸지 않는다', async () => {
    const f = fixture();
    const first = await f.service.updateEnvironment(
      f.target.id,
      desired,
      sha(original),
      actor,
    );
    f.rows[0].status = 'failed';
    const previousId = f.rows[0].deploymentRequestId;
    const network = disconnectedGateway(f);
    const retried = await f.service.retryDeployment(
      f.target.id,
      first.backupId,
    );
    expect(retried.requestId).not.toBe(previousId);
    expect(f.rows[0]).toMatchObject({
      status: 'deployment_queued',
      deploymentRequestId: retried.requestId,
    });
    await expect(
      f.service.retryDeployment(f.target.id, first.backupId),
    ).rejects.toBeInstanceOf(ConflictException);
    network.reconnect();
    expect((await f.service.listBackups(f.target.id))[0].status).toBe(
      'deployment_running',
    );
    expect(network.appliedCount()).toBe(1);
  });

  it.each(['update', 'retry'])(
    '%s의 UUID 의도 DB 저장 실패 시 원격 apply는 0회다',
    async (operation) => {
      const f = fixture();
      let backupId = '';
      if (operation === 'retry') {
        backupId = (
          await f.service.updateEnvironment(
            f.target.id,
            desired,
            sha(original),
            actor,
          )
        ).backupId;
        f.rows[0].status = 'failed';
        f.deployments.trigger.mockClear();
      }
      const save = f.backups.save.getMockImplementation()!;
      let rejected = false;
      f.backups.save.mockImplementation(async (row) => {
        if (row.status === 'deployment_queued' && !rejected) {
          rejected = true;
          throw new Error('synthetic intent storage failure');
        }
        return save(row);
      });
      const operationResult =
        operation === 'update'
          ? f.service.updateEnvironment(
              f.target.id,
              desired,
              sha(original),
              actor,
            )
          : f.service.retryDeployment(f.target.id, backupId);
      await expect(operationResult).rejects.toThrow(
        'synthetic intent storage failure',
      );
      expect(f.deployments.trigger).not.toHaveBeenCalled();
    },
  );

  it('불명 응답 후 진단 DB 저장까지 실패해도 이미 저장된 UUID/queued 의도를 보존한다', async () => {
    const f = fixture();
    const network = disconnectedGateway(f);
    const save = f.backups.save.getMockImplementation()!;
    let queuedSaves = 0;
    f.backups.save.mockImplementation(async (row) => {
      if (row.status === 'deployment_queued' && ++queuedSaves > 1)
        throw new Error('synthetic diagnostic storage failure');
      return save(row);
    });
    const result = await f.service.updateEnvironment(
      f.target.id,
      desired,
      sha(original),
      actor,
    );
    expect(f.rows[0]).toMatchObject({
      status: 'deployment_queued',
      deploymentRequestId: result.deployment.requestId,
    });
    expect(network.appliedCount()).toBe(1);
  });

  it('서버의 명시 거절만 실패로 확정한다', async () => {
    const f = fixture();
    f.deployments.trigger.mockRejectedValueOnce(new DeploymentRejectedError());
    await expect(
      f.service.updateEnvironment(f.target.id, desired, sha(original), actor),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(f.rows[0]).toMatchObject({
      status: 'failed',
      deploymentRequestId: expect.any(String),
    });
  });

  it.each(['github-actions', 'ssh-blue-green'])(
    '%s도 불명 전송 결과의 UUID를 잃지 않고 기존 상태 조회로 복구한다',
    async (provider) => {
      const f = fixture();
      f.target.provider =
        provider === 'github-actions' ? 'gcp-secret-manager' : 'ssh-env-file';
      f.target.deploymentProvider = provider;
      f.deployments.trigger.mockRejectedValueOnce(
        new Error('synthetic unknown transport outcome'),
      );
      const result = await f.service.updateEnvironment(
        f.target.id,
        desired,
        sha(original),
        actor,
      );
      expect(f.rows[0]).toMatchObject({
        deploymentRequestId: result.deployment.requestId,
        status: 'deployment_queued',
      });
      expect((await f.service.listBackups(f.target.id))[0].status).toBe(
        'deployed',
      );
      expect(f.deployments.findByRequestId).toHaveBeenCalledWith(
        f.target.id,
        result.deployment.requestId,
      );
    },
  );
});

describe('새 provider에도 기존 대상 권한과 감사 적용', () => {
  it('배정되지 않은 대상은 guard에서 거절한다', async () => {
    const access = {
      assertCanAccess: jest.fn().mockRejectedValue(new ForbiddenException()),
    };
    const guard = new KeyManagementTargetAccessGuard(access as any);
    const request = {
      user: { id: 'limited-user', roles: ['key_manager'] },
      params: { targetId: 'storage-production' },
    };
    await expect(
      guard.canActivate({
        switchToHttp: () => ({ getRequest: () => request }),
      } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(access.assertCanAccess).toHaveBeenCalledWith(
      request.user,
      request.params.targetId,
    );
  });

  it('공개·쓰기·복원·재시도는 기존 권한과 비밀값 없는 감사 메타데이터를 유지한다', () => {
    const controller = KeyManagementController.prototype;
    for (const [handler, permissions] of [
      [controller.reveal, [PERMISSIONS.SECRETS_REVEAL]],
      [
        controller.updateEnvironment,
        [PERMISSIONS.SECRETS_WRITE, PERMISSIONS.SECRETS_DEPLOY],
      ],
      [
        controller.restore,
        [PERMISSIONS.SECRETS_WRITE, PERMISSIONS.SECRETS_DEPLOY],
      ],
      [controller.retryDeployment, [PERMISSIONS.SECRETS_DEPLOY]],
    ] as const) {
      expect(Reflect.getMetadata('permissions', handler)).toEqual(permissions);
      const audit = Reflect.getMetadata(AUDIT_KEY, handler);
      expect(audit).toMatchObject({
        domain: 'secrets',
        targetType:
          handler === controller.restore ||
          handler === controller.retryDeployment
            ? 'secret-backup'
            : 'secret-target',
      });
      const metadata = audit.metadata({
        response: {
          version: sha(original),
          previousVersion: sha(desired),
          backupId: 'backup',
          changedKeys: ['MINIO_SECRET_KEY'],
          deployment: { requestId },
          requestId,
        },
        params: { backupId: 'source' },
      });
      expect(JSON.stringify(metadata)).not.toMatch(
        /synthetic|envFile|secretValue|encryptedPayload/,
      );
    }
  });
});
