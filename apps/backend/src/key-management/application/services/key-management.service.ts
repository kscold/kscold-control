import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  DEPLOYMENT_GATEWAY,
  DeploymentRun,
  IDeploymentGateway,
} from '../../domain/gateways/deployment.gateway.interface';
import {
  ISecretStoreGateway,
  SECRET_STORE_GATEWAY,
} from '../../domain/gateways/secret-store.gateway.interface';
import {
  SecretBackup,
  SecretBackupOperation,
} from '../../domain/entities/secret-backup.entity';
import {
  ISecretBackupRepository,
  SECRET_BACKUP_REPOSITORY,
} from '../../domain/repositories/secret-backup.repository.interface';
import { EnvDocumentService } from './env-document.service';
import { KeyManagementTargetService } from './key-management-target.service';
import { SecretEncryptionService } from './secret-encryption.service';

export interface KeyManagementActor {
  id: string;
  email: string;
}

export interface MutationResult {
  backupId: string;
  targetId: string;
  previousVersion: string;
  version: string;
  changedKeys: string[];
  deployment: {
    requestId: string;
    state: 'queued';
  };
}

@Injectable()
export class KeyManagementService {
  private updateQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly targets: KeyManagementTargetService,
    private readonly envDocument: EnvDocumentService,
    private readonly encryption: SecretEncryptionService,
    @Inject(SECRET_STORE_GATEWAY)
    private readonly secretStore: ISecretStoreGateway,
    @Inject(DEPLOYMENT_GATEWAY)
    private readonly deployments: IDeploymentGateway,
    @Inject(SECRET_BACKUP_REPOSITORY)
    private readonly backups: ISecretBackupRepository,
  ) {}

  async listTargets() {
    return Promise.all(
      this.targets.list().map(async (target) => {
        const current = await this.secretStore.readLatest(target.id);
        const keys = this.envDocument.listKeys(current.payload);
        return {
          ...target,
          version: current.version,
          updatedAt: current.createdAt,
          checksum: this.envDocument.checksum(current.payload),
          keyCount: keys.length,
          keys,
        };
      }),
    );
  }

  async reveal(targetId: string) {
    this.targets.get(targetId);
    const current = await this.secretStore.readLatest(targetId);
    const envFile = this.envDocument.normalizeAndValidate(current.payload);
    return {
      targetId,
      version: current.version,
      checksum: this.envDocument.checksum(current.payload),
      envFile,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
  }

  updateEnvironment(
    targetId: string,
    envFile: string,
    expectedVersion: string,
    actor: KeyManagementActor,
  ): Promise<MutationResult> {
    return this.withUpdateLock(() =>
      this.mutate(targetId, expectedVersion, 'update', actor, () => envFile),
    );
  }

  patchEnvironmentKey(
    targetId: string,
    key: string,
    secretValue: string,
    expectedVersion: string,
    actor: KeyManagementActor,
  ): Promise<MutationResult> {
    return this.withUpdateLock(() =>
      this.mutate(targetId, expectedVersion, 'patch', actor, (current) =>
        this.envDocument.setKey(current, key, secretValue),
      ),
    );
  }

  async listBackups(targetId: string, limit = 30) {
    this.targets.get(targetId);
    const backups = await this.backups.findRecent(targetId, limit);
    const active = backups.find(
      (backup) =>
        backup.deploymentRequestId &&
        ['deployment_queued', 'deployment_running'].includes(backup.status),
    );

    if (active?.deploymentRequestId) {
      try {
        const run = await this.deployments.findByRequestId(
          active.deploymentRequestId,
        );
        if (run) await this.applyDeploymentState(active, run);
      } catch {
        // GitHub 상태 조회 장애가 백업 원장 자체를 가리지 않게 마지막 상태를 반환한다.
      }
    }

    return backups.map((backup) => this.toBackupResponse(backup));
  }

  restore(
    targetId: string,
    backupId: string,
    expectedVersion: string,
    actor: KeyManagementActor,
  ): Promise<MutationResult> {
    return this.withUpdateLock(async () => {
      this.targets.get(targetId);
      const source = await this.backups.findByIdWithPayload(backupId);
      if (!source || source.targetId !== targetId) {
        throw new NotFoundException('복원할 백업을 찾을 수 없습니다.');
      }

      let restoredPayload: string;
      try {
        restoredPayload = this.encryption.decrypt(
          source.encryptedPayload,
          source.iv,
          source.authTag,
          this.associatedData(source.targetId, source.sourceVersion),
        );
      } catch {
        throw new BadRequestException(
          '백업 무결성 검증에 실패해 복원을 중단했습니다.',
        );
      }

      return this.mutate(
        targetId,
        expectedVersion,
        'restore',
        actor,
        () => restoredPayload,
        backupId,
      );
    });
  }

  async retryDeployment(targetId: string, backupId: string) {
    this.targets.get(targetId);
    const backup = await this.backups.findByIdWithPayload(backupId);
    if (
      !backup ||
      backup.targetId !== targetId ||
      !backup.newVersion ||
      backup.status !== 'failed'
    ) {
      throw new NotFoundException('재시도할 배포를 찾을 수 없습니다.');
    }

    const current = await this.secretStore.readLatest(targetId);
    if (current.version !== backup.newVersion) {
      throw new ConflictException(
        '더 최신 환경 변수 버전이 있어 이전 배포를 재시도할 수 없습니다.',
      );
    }

    const requestId = randomUUID();
    await this.deployments.trigger({
      targetId,
      version: backup.newVersion,
      requestId,
    });
    backup.deploymentRequestId = requestId;
    backup.deploymentRunId = null;
    backup.deploymentUrl = null;
    backup.errorMessage = null;
    backup.status = 'deployment_queued';
    await this.backups.save(backup);

    return { requestId, state: 'queued' as const, version: backup.newVersion };
  }

  private async mutate(
    targetId: string,
    expectedVersion: string,
    operation: SecretBackupOperation,
    actor: KeyManagementActor,
    createNext: (current: string) => string,
    restoredFromBackupId: string | null = null,
  ): Promise<MutationResult> {
    this.targets.get(targetId);
    const current = await this.secretStore.readLatest(targetId);
    if (current.version !== expectedVersion) {
      throw new ConflictException(
        `환경 변수 버전이 변경되었습니다. 현재 버전은 ${current.version}입니다. 다시 조회하세요.`,
      );
    }

    const next = this.envDocument.normalizeAndValidate(
      createNext(current.payload),
    );
    const changedKeys = this.envDocument.changedKeys(current.payload, next);
    if (changedKeys.length === 0) {
      throw new BadRequestException('변경된 환경 변수가 없습니다.');
    }

    const encrypted = this.encryption.encrypt(
      current.payload,
      this.associatedData(targetId, current.version),
    );
    const backup = this.backups.create({
      targetId,
      operation,
      sourceVersion: current.version,
      newVersion: null,
      checksum: this.envDocument.checksum(current.payload),
      changedKeys,
      ...encrypted,
      actorId: actor.id,
      actorEmail: actor.email,
      status: 'backed_up',
      deploymentRequestId: null,
      deploymentRunId: null,
      deploymentUrl: null,
      errorMessage: null,
      restoredFromBackupId,
    });

    // 이 저장이 실패하면 아래의 Secret Manager 변경에는 절대 도달하지 않는다.
    await this.backups.save(backup);

    try {
      const latestAfterBackup = await this.secretStore.readLatest(targetId);
      if (
        latestAfterBackup.version !== current.version ||
        this.envDocument.checksum(latestAfterBackup.payload) !==
          this.envDocument.checksum(current.payload)
      ) {
        throw new ConflictException(
          '백업 도중 다른 변경이 감지되어 새 버전 생성을 중단했습니다.',
        );
      }

      const added = await this.secretStore.addVersion(targetId, next);
      backup.newVersion = added.version;
      backup.status = 'secret_created';
      await this.backups.save(backup);

      const requestId = randomUUID();
      await this.deployments.trigger({
        targetId,
        version: added.version,
        requestId,
      });
      backup.deploymentRequestId = requestId;
      backup.status = 'deployment_queued';
      await this.backups.save(backup);

      return {
        backupId: backup.id,
        targetId,
        previousVersion: current.version,
        version: added.version,
        changedKeys,
        deployment: { requestId, state: 'queued' },
      };
    } catch (error) {
      backup.status = 'failed';
      backup.errorMessage = this.publicErrorMessage(error);
      await this.backups.save(backup);
      throw error;
    }
  }

  private async applyDeploymentState(
    backup: SecretBackup,
    run: DeploymentRun,
  ): Promise<void> {
    backup.deploymentRunId = run.runId;
    backup.deploymentUrl = run.url;
    backup.status =
      run.state === 'succeeded'
        ? 'deployed'
        : run.state === 'failed'
          ? 'failed'
          : run.state === 'running'
            ? 'deployment_running'
            : 'deployment_queued';
    backup.errorMessage =
      run.state === 'failed'
        ? `GitHub Actions 배포 실패: ${run.conclusion ?? 'unknown'}`
        : null;
    await this.backups.save(backup);
  }

  private toBackupResponse(backup: SecretBackup) {
    return {
      id: backup.id,
      targetId: backup.targetId,
      operation: backup.operation,
      sourceVersion: backup.sourceVersion,
      newVersion: backup.newVersion,
      checksum: backup.checksum,
      changedKeys: backup.changedKeys,
      actorId: backup.actorId,
      actorEmail: backup.actorEmail,
      status: backup.status,
      deploymentRequestId: backup.deploymentRequestId,
      deploymentRunId: backup.deploymentRunId,
      deploymentUrl: backup.deploymentUrl,
      errorMessage: backup.errorMessage,
      restoredFromBackupId: backup.restoredFromBackupId,
      createdAt: backup.createdAt,
      updatedAt: backup.updatedAt,
    };
  }

  private associatedData(targetId: string, version: string): string {
    return `${targetId}:${version}`;
  }

  private publicErrorMessage(error: unknown): string {
    if (error instanceof ConflictException) {
      return '동시 변경이 감지되어 중단됨';
    }
    return '환경 변수 반영 단계에서 실패함';
  }

  private async withUpdateLock<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.updateQueue;
    let release: () => void = () => undefined;
    this.updateQueue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}
