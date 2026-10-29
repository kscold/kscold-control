import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { EnvDocumentService } from '@/key-management/application/services/env-document.service';
import { KeyManagementTargetService } from '@/key-management/application/services/key-management-target.service';
import { SshEnvCommandGateway } from '@/key-management/infrastructure/gateways/ssh-env-command.gateway';
import { RoutingSecretStoreGateway } from '@/key-management/infrastructure/gateways/routing-secret-store.gateway';
import { RoutingDeploymentGateway } from '@/key-management/infrastructure/gateways/routing-deployment.gateway';
import type { KeyManagementTarget } from '@/key-management/domain/types/key-management-target.type';
import { DeploymentRejectedError } from '@/key-management/domain/gateways/deployment.gateway.interface';

const target: KeyManagementTarget = {
  id: 'storage-production',
  displayName: 'Storage Production',
  description: '서버 오브젝트 스토리지 설정만 관리',
  environment: 'production',
  provider: 'ssh-env-command',
  deploymentProvider: 'ssh-env-command',
  envFileName: 'server.env',
  instanceName: 'example-instance',
  location: '192.0.2.10',
  requiredKeys: [
    'MINIO_ACCESS_KEY',
    'MINIO_SECRET_KEY',
    'MINIO_ENDPOINT',
    'MINIO_BUCKET',
  ],
  secretConfig: {
    host: '192.0.2.10',
    port: 22,
    username: 'root',
    credentialRef: 'storage-production',
    protocol: 'env-v1',
    allowedKeys: [
      'MINIO_ACCESS_KEY',
      'MINIO_SECRET_KEY',
      'MINIO_ENDPOINT',
      'MINIO_BUCKET',
    ],
  },
  deploymentConfig: { protocol: 'env-v1' },
  enabled: true,
  sortOrder: 30,
};
const current =
  'MINIO_ACCESS_KEY=synthetic-access\nMINIO_SECRET_KEY=synthetic-old\nMINIO_ENDPOINT=http://127.0.0.1:9000\nMINIO_BUCKET=storage-test\n';
const next = current.replace('synthetic-old', 'synthetic-new');
const sha = (payload: string) =>
  createHash('sha256').update(payload).digest('hex');
const at = '2026-10-28T01:00:00.000Z';
const requestId = '11111111-1111-4111-8111-111111111111';
const response = (value: unknown) =>
  JSON.stringify({ protocol: 'env-v1', ok: true, ...(value as object) });
const record = {
  requestId,
  version: sha(next),
  revision: 'a'.repeat(40),
  state: 'queued',
  conclusion: null,
  createdAt: at,
  updatedAt: at,
};

function fixture() {
  const targets = { get: jest.fn().mockResolvedValue(target) };
  const ssh = { execute: jest.fn() };
  const gateway = new SshEnvCommandGateway(
    targets as any,
    ssh as any,
    new EnvDocumentService(),
  );
  return { targets, ssh, gateway };
}

describe('SshEnvCommandGateway', () => {
  it('명시 apply 거절과 worker/전송 불명은 서로 다른 결과로 분류한다', async () => {
    const { ssh, gateway } = fixture();
    ssh.execute.mockResolvedValueOnce(
      JSON.stringify({
        protocol: 'env-v1',
        ok: false,
        code: 'recovery_required',
      }),
    );
    await expect(
      gateway.trigger({ targetId: target.id, requestId, version: sha(next) }),
    ).rejects.toBeInstanceOf(DeploymentRejectedError);
    expect(ssh.execute).toHaveBeenCalledTimes(1);
    ssh.execute
      .mockResolvedValueOnce(
        JSON.stringify({
          protocol: 'env-v1',
          ok: false,
          code: 'worker_unavailable',
        }),
      )
      .mockRejectedValueOnce(new Error('status unavailable'));
    await expect(
      gateway.trigger({ targetId: target.id, requestId, version: sha(next) }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(ssh.execute.mock.calls[2][1]).toBe(`env-v1 status ${requestId}`);
  });
  it('고정 read 명령만 사용하고 허용 본문과 SHA-256을 검증한다', async () => {
    const { ssh, gateway } = fixture();
    ssh.execute.mockResolvedValue(
      response({ version: sha(current), payload: current, createdAt: at }),
    );
    await expect(gateway.readLatest(target.id)).resolves.toEqual({
      version: sha(current),
      payload: current,
      createdAt: at,
    });
    expect(ssh.execute).toHaveBeenCalledWith(
      target,
      'env-v1 read',
      expect.objectContaining({ maxOutputBytes: 2 * 256 * 1024 + 4096 }),
    );
  });

  it('쓰기 본문은 stdin으로만 전달하고 원격 경로나 셸을 조립하지 않는다', async () => {
    const { ssh, gateway } = fixture();
    ssh.execute.mockResolvedValue(
      response({ version: sha(next), createdAt: at }),
    );
    await expect(
      gateway.addVersion(target.id, next, sha(current)),
    ).resolves.toEqual({ version: sha(next), createdAt: at });
    expect(ssh.execute).toHaveBeenCalledWith(
      target,
      `env-v1 write ${sha(current)} ${sha(next)}`,
      expect.objectContaining({ input: next }),
    );
    expect(ssh.execute.mock.calls[0][1]).not.toMatch(/synthetic|\/|bash|sh -c/);
  });

  it.each([
    'latest',
    '1',
    'A'.repeat(64),
    'a'.repeat(63),
    `a${'b'.repeat(63)};id`,
  ])('잘못된 버전 %s은 SSH 전에 거절한다', async (version) => {
    const { ssh, gateway } = fixture();
    await expect(
      gateway.addVersion(target.id, next, version),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      gateway.trigger({ targetId: target.id, requestId, version }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(ssh.execute).not.toHaveBeenCalled();
  });

  it.each([
    'NODE_OPTIONS=--require=/tmp/a',
    'LD_PRELOAD=/tmp/a',
    'PATH=/tmp',
    'MONGODB_URI=mongodb://test',
  ])('관리 범위 밖의 %s을 SSH 전에 차단한다', async (extra) => {
    const { ssh, gateway } = fixture();
    await expect(
      gateway.addVersion(target.id, `${next}${extra}\n`, sha(current)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(ssh.execute).not.toHaveBeenCalled();
  });

  describe('allowedKeys 가 전체(*)인 대상', () => {
    const anyTarget = {
      ...target,
      secretConfig: { ...target.secretConfig, allowedKeys: ['*'] },
    };
    const anyFixture = () => {
      const result = fixture();
      result.targets.get.mockResolvedValue(anyTarget);
      return result;
    };

    it('예약 키가 아닌 새 기능 키는 그대로 서버로 보낸다', async () => {
      const { ssh, gateway } = anyFixture();
      const payload = `${next}OPENAI_API_KEY=sk-synthetic\n`;
      ssh.execute.mockResolvedValue(
        response({ version: sha(payload), createdAt: at }),
      );
      await expect(
        gateway.addVersion(target.id, payload, sha(current)),
      ).resolves.toEqual({ version: sha(payload), createdAt: at });
    });

    it.each([
      'NODE_OPTIONS=--require=/tmp/a',
      'PORT=9999',
      'NEXT_PUBLIC_API_URL=https://example.test',
      'PM2_HOME=/tmp/pm2',
      'PATH=/tmp',
    ])('예약 키 %s 는 SSH 전에 차단한다', async (extra) => {
      const { ssh, gateway } = anyFixture();
      await expect(
        gateway.addVersion(target.id, `${next}${extra}\n`, sha(current)),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(ssh.execute).not.toHaveBeenCalled();
    });
  });

  it.each(['version_conflict', 'request_conflict', 'deployment_busy'])(
    '서버 %s는 재시도 쓰기 없이 충돌로 반환한다',
    async (code) => {
      const { ssh, gateway } = fixture();
      ssh.execute.mockResolvedValue(
        JSON.stringify({ protocol: 'env-v1', ok: false, code }),
      );
      await expect(
        gateway.addVersion(target.id, next, sha(current)),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(ssh.execute).toHaveBeenCalledTimes(1);
    },
  );

  it('응답이 끊긴 쓰기는 원하는 SHA가 실제 저장된 경우에만 성공으로 복구한다', async () => {
    const { ssh, gateway } = fixture();
    ssh.execute
      .mockRejectedValueOnce(new Error('connection lost'))
      .mockResolvedValueOnce(
        response({ payload: next, version: sha(next), createdAt: at }),
      );
    await expect(
      gateway.addVersion(target.id, next, sha(current)),
    ).resolves.toHaveProperty('version', sha(next));
    expect(ssh.execute.mock.calls[1][1]).toBe('env-v1 read');
  });

  it('read의 SHA나 응답 프로토콜이 다르면 본문을 반환하지 않는다', async () => {
    const { ssh, gateway } = fixture();
    for (const output of [
      response({ payload: current, version: sha(next), createdAt: at }),
      JSON.stringify({ protocol: 'env-v2', ok: true, payload: current }),
      '<html>synthetic-secret</html>',
    ]) {
      ssh.execute.mockResolvedValue(output);
      await expect(gateway.readLatest(target.id)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    }
  });

  it('현재 버전 외 과거 파일은 저장소에서 읽지 않고 암호화 백업을 사용한다', async () => {
    const { ssh, gateway } = fixture();
    ssh.execute.mockResolvedValue(
      response({ payload: next, version: sha(next), createdAt: at }),
    );
    await expect(
      gateway.readVersion(target.id, sha(current)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('apply UUID와 정확한 환경 버전을 전송하고 상태를 조회한다', async () => {
    const { ssh, gateway } = fixture();
    ssh.execute.mockResolvedValue(response({ record }));
    await gateway.trigger({
      targetId: target.id,
      requestId,
      version: sha(next),
    });
    expect(ssh.execute.mock.calls[0][1]).toBe(
      `env-v1 apply ${requestId} ${sha(next)}`,
    );
    ssh.execute.mockResolvedValue(
      response({
        record: { ...record, state: 'failed', conclusion: 'activation_failed' },
      }),
    );
    await expect(
      gateway.findByRequestId(target.id, requestId),
    ).resolves.toMatchObject({
      requestId,
      state: 'failed',
      conclusion: 'activation_failed',
      url: null,
    });
    expect(ssh.execute.mock.calls[1][1]).toBe(`env-v1 status ${requestId}`);
  });

  it('apply 응답 손실은 같은 UUID와 버전의 영속 상태가 있을 때 복구한다', async () => {
    const { ssh, gateway } = fixture();
    ssh.execute
      .mockRejectedValueOnce(new Error('connection lost'))
      .mockResolvedValueOnce(response({ record }));
    await expect(
      gateway.trigger({ targetId: target.id, requestId, version: sha(next) }),
    ).resolves.toBeUndefined();
    expect(ssh.execute).toHaveBeenCalledTimes(2);
    expect(ssh.execute.mock.calls[1][1]).toBe(`env-v1 status ${requestId}`);
  });

  it('다른 UUID의 상태나 자유 형식 실패 로그를 API에 노출하지 않는다', async () => {
    const { ssh, gateway } = fixture();
    for (const bad of [
      { ...record, requestId: '22222222-2222-4222-8222-222222222222' },
      { ...record, conclusion: 'synthetic-secret' },
    ]) {
      ssh.execute.mockResolvedValue(response({ record: bad }));
      await expect(
        gateway.findByRequestId(target.id, requestId),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    }
  });

  it('서버 권한 오류에는 내부 메시지나 본문을 섞지 않는다', async () => {
    const { ssh, gateway } = fixture();
    ssh.execute.mockResolvedValue(
      JSON.stringify({
        protocol: 'env-v1',
        ok: false,
        code: 'unsafe_permissions',
        detail: 'synthetic-secret',
      }),
    );
    await expect(gateway.readLatest(target.id)).rejects.toThrow(
      '서버 환경 명령을 완료하지 못했습니다.',
    );
  });

  it('없는 상태와 잘못된 요청 ID는 배포를 생성하지 않는다', async () => {
    const { ssh, gateway } = fixture();
    await expect(
      gateway.findByRequestId(target.id, '../../etc/passwd'),
    ).resolves.toBeNull();
    expect(ssh.execute).not.toHaveBeenCalled();
    ssh.execute.mockResolvedValue(response({ record: null }));
    await expect(
      gateway.findByRequestId(target.id, requestId),
    ).resolves.toBeNull();
  });
});

describe('env-v1 target registration contract and routing', () => {
  const serviceFor = (row: unknown) =>
    new KeyManagementTargetService({
      findEnabledById: jest.fn().mockResolvedValue(row),
    } as any);

  it('DB에 명시적으로 등록된 대상만 활성화한다', async () => {
    await expect(serviceFor(target).get(target.id)).resolves.toEqual(target);
    await expect(serviceFor(null).get(target.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it.each([
    { ...target.secretConfig, envPath: '/etc/passwd' },
    { ...target.secretConfig, command: 'bash' },
    { ...target.secretConfig, protocol: 'env-v2' },
    { ...target.secretConfig, allowedKeys: ['NODE_OPTIONS'] },
    {
      ...target.secretConfig,
      allowedKeys: ['MINIO_ACCESS_KEY', 'MINIO_ACCESS_KEY'],
    },
    { ...target.secretConfig, credentialRef: '../../existing-key' },
    { ...target.secretConfig, allowedKeys: ['*', 'MINIO_BUCKET'] },
  ])('잘못된 command provider 설정을 거절한다', async (secretConfig) => {
    await expect(
      serviceFor({ ...target, secretConfig }).get(target.id),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('allowedKeys 를 * 하나로 두면 예약 키를 뺀 전체 관리 대상으로 받는다', async () => {
    const row = {
      ...target,
      secretConfig: { ...target.secretConfig, allowedKeys: ['*'] },
    };
    await expect(serviceFor(row).get(target.id)).resolves.toEqual(row);
  });

  it('전체 관리 대상이라도 예약 키를 필수 키로 둘 수 없다', async () => {
    await expect(
      serviceFor({
        ...target,
        requiredKeys: ['PORT'],
        secretConfig: { ...target.secretConfig, allowedKeys: ['*'] },
      }).get(target.id),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('쉘 배포와 command provider를 섞을 수 없다', async () => {
    await expect(
      serviceFor({
        ...target,
        deploymentProvider: 'ssh-blue-green',
        deploymentConfig: {
          workingDirectory: '/tmp/app',
          script: 'deploy.sh',
          statusDirectory: '/tmp/status',
        },
      }).get(target.id),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(
      serviceFor({
        ...target,
        deploymentConfig: { protocol: 'env-v1', script: 'deploy.sh' },
      }).get(target.id),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it.each([
    ['gcp-secret-manager', 'github-actions', 0],
    ['ssh-env-file', 'ssh-blue-green', 1],
    ['ssh-env-command', 'ssh-env-command', 2],
  ])(
    '%s의 기존 경로를 유지하면서 provider를 선택한다',
    async (provider, deploymentProvider, index) => {
      const targets = {
        get: jest
          .fn()
          .mockResolvedValue({ ...target, provider, deploymentProvider }),
      };
      const gateways = Array.from({ length: 3 }, () => ({
        readLatest: jest.fn().mockResolvedValue('selected'),
        trigger: jest.fn(),
      }));
      const secrets = new RoutingSecretStoreGateway(
        targets as any,
        ...(gateways as [any, any, any]),
      );
      const deployments = new RoutingDeploymentGateway(
        targets as any,
        ...(gateways as [any, any, any]),
      );
      await secrets.readLatest(target.id);
      await deployments.trigger({
        targetId: target.id,
        version: sha(next),
        requestId,
      });
      gateways.forEach((gateway, i) => {
        expect(gateway.readLatest).toHaveBeenCalledTimes(i === index ? 1 : 0);
        expect(gateway.trigger).toHaveBeenCalledTimes(i === index ? 1 : 0);
      });
    },
  );
});
