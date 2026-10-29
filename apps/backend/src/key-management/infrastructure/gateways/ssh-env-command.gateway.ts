import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type {
  AddedSecretVersion,
  ISecretStoreGateway,
  SecretStoreVersion,
} from '../../domain/gateways/secret-store.gateway.interface';
import type {
  DeploymentRun,
  IDeploymentGateway,
  TriggerDeploymentInput,
} from '../../domain/gateways/deployment.gateway.interface';
import { DeploymentRejectedError } from '../../domain/gateways/deployment.gateway.interface';
import type {
  KeyManagementTarget,
  SshEnvCommandSecretStoreConfig,
} from '../../domain/types/key-management-target.type';
import { KeyManagementTargetService } from '../../application/services/key-management-target.service';
import { EnvDocumentService } from '../../application/services/env-document.service';
import { SshTargetCommandService } from './ssh-target-command.service';
import { isAllowedEnvCommandKey } from '../../domain/policies/env-command-key.policy';

const SHA = /^[a-f0-9]{64}$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_BYTES = 256 * 1024;
const checksum = (payload: string) =>
  createHash('sha256').update(payload).digest('hex');

// Fixed protocol verbs only. The server owns all paths and runtime policy.
@Injectable()
export class SshEnvCommandGateway
  implements ISecretStoreGateway, IDeploymentGateway
{
  constructor(
    private readonly targets: KeyManagementTargetService,
    private readonly ssh: SshTargetCommandService,
    private readonly documents: EnvDocumentService,
  ) {}

  async readLatest(targetId: string): Promise<SecretStoreVersion> {
    const target = await this.target(targetId);
    const result = await this.request(
      target,
      'env-v1 read',
      undefined,
      2 * MAX_BYTES + 4096,
    );
    if (
      typeof result.payload !== 'string' ||
      Buffer.byteLength(result.payload) > MAX_BYTES ||
      typeof result.version !== 'string' ||
      !SHA.test(result.version) ||
      checksum(result.payload) !== result.version ||
      !this.timestamp(result.createdAt)
    )
      this.invalidResponse();
    this.validatePayload(target, result.payload as string);
    return {
      payload: result.payload as string,
      version: result.version as string,
      createdAt: result.createdAt as string,
    };
  }

  async readVersion(
    targetId: string,
    version: string,
  ): Promise<SecretStoreVersion> {
    this.assertVersion(version);
    const current = await this.readLatest(targetId);
    if (current.version !== version)
      throw new NotFoundException(
        '서버 환경 파일의 현재 버전과 요청 버전이 다릅니다.',
      );
    return current;
  }

  async addVersion(
    targetId: string,
    payload: string,
    expectedVersion: string,
  ): Promise<AddedSecretVersion> {
    this.assertVersion(expectedVersion);
    const target = await this.target(targetId);
    this.validatePayload(target, payload);
    const version = checksum(payload);
    try {
      const result = await this.request(
        target,
        `env-v1 write ${expectedVersion} ${version}`,
        payload,
      );
      if (result.version !== version || !this.timestamp(result.createdAt))
        this.invalidResponse();
      return { version, createdAt: result.createdAt as string };
    } catch (error) {
      // Recover a lost acknowledgement without blindly repeating a write.
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      )
        throw error;
      const current = await this.readLatest(targetId).catch(() => null);
      if (current?.version === version)
        return { version, createdAt: current.createdAt };
      if (current && current.version !== expectedVersion)
        throw new ConflictException(
          '다른 작업에서 서버 환경 파일을 변경했습니다.',
        );
      throw error;
    }
  }

  async trigger(input: TriggerDeploymentInput): Promise<void> {
    this.assertVersion(input.version);
    if (!UUID.test(input.requestId))
      throw new BadRequestException(
        '환경 적용 요청 ID 형식이 올바르지 않습니다.',
      );
    const target = await this.target(input.targetId);
    try {
      const result = await this.request(
        target,
        `env-v1 apply ${input.requestId} ${input.version}`,
        undefined,
        4096,
        true,
      );
      const run = this.deployment(result.record, input.requestId);
      if (
        !run ||
        (result.record as Record<string, unknown>).version !== input.version
      )
        this.invalidResponse();
    } catch (error) {
      if (
        error instanceof DeploymentRejectedError ||
        error instanceof BadRequestException ||
        error instanceof ConflictException
      )
        throw error;
      const result = await this.request(
        target,
        `env-v1 status ${input.requestId}`,
      ).catch(() => null);
      if (
        result &&
        this.deployment(result.record, input.requestId) &&
        (result.record as Record<string, unknown>).version === input.version
      )
        return;
      throw error;
    }
  }

  async findByRequestId(
    targetId: string,
    requestId: string,
  ): Promise<DeploymentRun | null> {
    if (!UUID.test(requestId)) return null;
    const target = await this.target(targetId);
    const result = await this.request(target, `env-v1 status ${requestId}`);
    return this.deployment(result.record, requestId);
  }

  private deployment(value: unknown, requestId: string): DeploymentRun | null {
    if (value === null) return null;
    if (!value || typeof value !== 'object' || Array.isArray(value))
      this.invalidResponse();
    const record = value as Record<string, unknown>;
    if (
      record.requestId !== requestId ||
      typeof record.version !== 'string' ||
      !SHA.test(record.version) ||
      typeof record.revision !== 'string' ||
      !/^[a-f0-9]{40}$/.test(record.revision) ||
      !['queued', 'running', 'succeeded', 'failed'].includes(
        record.state as string,
      ) ||
      !this.timestamp(record.createdAt) ||
      !this.timestamp(record.updatedAt) ||
      ![null, 'success', 'activation_failed', 'interrupted'].includes(
        record.conclusion as string | null,
      )
    )
      this.invalidResponse();
    return {
      requestId,
      runId: requestId,
      state: record.state as DeploymentRun['state'],
      conclusion: record.conclusion as string | null,
      url: null,
      createdAt: record.createdAt as string,
      updatedAt: record.updatedAt as string,
    };
  }

  private async target(id: string): Promise<KeyManagementTarget> {
    const target = await this.targets.get(id);
    if (
      target.provider !== 'ssh-env-command' ||
      target.deploymentProvider !== 'ssh-env-command'
    )
      throw new ServiceUnavailableException(
        'SSH 환경 명령 대상 설정이 올바르지 않습니다.',
      );
    return target;
  }

  private validatePayload(target: KeyManagementTarget, payload: string): void {
    if (typeof payload !== 'string' || Buffer.byteLength(payload) > MAX_BYTES)
      throw new BadRequestException('환경 파일 크기가 제한을 초과했습니다.');
    const normalized = this.documents.normalizeAndValidate(
      payload,
      target.requiredKeys,
    );
    const config = target.secretConfig as SshEnvCommandSecretStoreConfig;
    if (
      this.documents
        .listKeys(normalized)
        .some((key) => !isAllowedEnvCommandKey(config.allowedKeys, key))
    )
      throw new BadRequestException(
        '이 대상에서 관리할 수 없는 환경 변수입니다.',
      );
  }

  private async request(
    target: KeyManagementTarget,
    command: string,
    input?: string,
    maxOutputBytes = 4096,
    applying = false,
  ): Promise<Record<string, unknown>> {
    const output = await this.ssh.execute(target, command, {
      input,
      timeoutMs: 25_000,
      maxOutputBytes,
    });
    let result: Record<string, unknown>;
    try {
      result = JSON.parse(output);
    } catch {
      return this.invalidResponse();
    }
    if (
      !result ||
      result.protocol !== 'env-v1' ||
      typeof result.ok !== 'boolean'
    )
      this.invalidResponse();
    if (!result.ok) {
      if (
        applying &&
        [
          'invalid_command',
          'version_conflict',
          'request_conflict',
          'deployment_busy',
          'invalid_environment',
          'unsupported_environment',
          'missing_environment',
          'unsafe_permissions',
          'invalid_release',
          'invalid_boot_configuration',
          'recovery_required',
        ].includes(result.code as string)
      )
        throw new DeploymentRejectedError();
      if (
        ['version_conflict', 'request_conflict', 'deployment_busy'].includes(
          result.code as string,
        )
      )
        throw new ConflictException(
          '서버 버전 또는 배포 작업이 충돌했습니다. 상태를 새로 조회하세요.',
        );
      if (
        [
          'invalid_environment',
          'unsupported_environment',
          'missing_environment',
          'invalid_endpoint',
          'invalid_bucket',
          'input_too_large',
          'checksum_mismatch',
        ].includes(result.code as string)
      )
        throw new BadRequestException(
          '서버 환경 변수의 허용 키와 값 형식을 확인하세요.',
        );
      throw new ServiceUnavailableException(
        '서버 환경 명령을 완료하지 못했습니다.',
      );
    }
    return result;
  }

  private assertVersion(version: string): void {
    if (!SHA.test(version))
      throw new BadRequestException('서버 환경 버전은 SHA-256이어야 합니다.');
  }

  private timestamp(value: unknown): value is string {
    return (
      typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}T/.test(value) &&
      Number.isFinite(Date.parse(value))
    );
  }

  private invalidResponse(): never {
    throw new ServiceUnavailableException(
      '서버 환경 명령 응답의 무결성을 확인하지 못했습니다.',
    );
  }
}
