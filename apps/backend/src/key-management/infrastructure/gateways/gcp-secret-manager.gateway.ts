import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AddedSecretVersion,
  ISecretStoreGateway,
  SecretStoreVersion,
} from '../../domain/gateways/secret-store.gateway.interface';
import { KeyManagementTargetService } from '../../application/services/key-management-target.service';
import type { GcpSecretStoreConfig } from '../../domain/types/key-management-target.type';
import { runProcess } from './process-runner';

interface GcloudVersionDescription {
  name?: string;
  createTime?: string;
}

@Injectable()
export class GcpSecretManagerGateway implements ISecretStoreGateway {
  private readonly gcloudPath: string;

  constructor(
    config: ConfigService,
    private readonly targets: KeyManagementTargetService,
  ) {
    this.gcloudPath =
      config.get<string>('KEY_MANAGEMENT_GCLOUD_PATH') ??
      '/opt/homebrew/bin/gcloud';
  }

  async readLatest(targetId: string): Promise<SecretStoreVersion> {
    const target = await this.targets.get(targetId);
    const config = target.secretConfig as GcpSecretStoreConfig;
    const description = await this.describeVersion(targetId, 'latest');
    const version = this.extractVersion(description.name);
    const payload = await this.accessVersion(
      config.projectId,
      config.secretName,
      config.serviceAccount,
      version,
    );

    return {
      version,
      payload,
      createdAt: description.createTime ?? null,
    };
  }

  async readVersion(
    targetId: string,
    version: string,
  ): Promise<SecretStoreVersion> {
    this.assertVersion(version);
    const target = await this.targets.get(targetId);
    const config = target.secretConfig as GcpSecretStoreConfig;
    const description = await this.describeVersion(targetId, version);
    const payload = await this.accessVersion(
      config.projectId,
      config.secretName,
      config.serviceAccount,
      version,
    );

    return {
      version,
      payload,
      createdAt: description.createTime ?? null,
    };
  }

  async addVersion(
    targetId: string,
    payload: string,
    expectedVersion: string,
  ): Promise<AddedSecretVersion> {
    this.assertVersion(expectedVersion);
    const target = await this.targets.get(targetId);
    const config = target.secretConfig as GcpSecretStoreConfig;
    const latest = await this.describeVersion(targetId, 'latest');
    if (this.extractVersion(latest.name) !== expectedVersion) {
      throw new ConflictException(
        'GCP Secret Manager가 다른 작업에서 변경되어 반영을 중단했습니다.',
      );
    }
    try {
      const { stdout } = await runProcess(
        this.gcloudPath,
        [
          'secrets',
          'versions',
          'add',
          config.secretName,
          '--data-file=-',
          `--project=${config.projectId}`,
          `--impersonate-service-account=${config.serviceAccount}`,
          '--quiet',
          '--format=json(name,createTime)',
        ],
        { input: payload },
      );
      const parsed = JSON.parse(stdout) as GcloudVersionDescription;
      return {
        version: this.extractVersion(parsed.name),
        createdAt: parsed.createTime ?? null,
      };
    } catch {
      throw new ServiceUnavailableException(
        'GCP Secret Manager에 새 버전을 만들지 못했습니다.',
      );
    }
  }

  private async describeVersion(
    targetId: string,
    version: string,
  ): Promise<GcloudVersionDescription> {
    if (version !== 'latest') this.assertVersion(version);
    const target = await this.targets.get(targetId);
    const config = target.secretConfig as GcpSecretStoreConfig;
    try {
      const { stdout } = await runProcess(this.gcloudPath, [
        'secrets',
        'versions',
        'describe',
        version,
        `--secret=${config.secretName}`,
        `--project=${config.projectId}`,
        `--impersonate-service-account=${config.serviceAccount}`,
        '--quiet',
        '--format=json(name,createTime)',
      ]);
      return JSON.parse(stdout) as GcloudVersionDescription;
    } catch {
      throw new ServiceUnavailableException(
        'GCP Secret Manager 버전 정보를 읽지 못했습니다.',
      );
    }
  }

  private async accessVersion(
    projectId: string,
    secretName: string,
    serviceAccount: string,
    version: string,
  ): Promise<string> {
    try {
      const { stdout } = await runProcess(
        this.gcloudPath,
        [
          'secrets',
          'versions',
          'access',
          version,
          `--secret=${secretName}`,
          `--project=${projectId}`,
          `--impersonate-service-account=${serviceAccount}`,
          '--quiet',
        ],
        { maxOutputBytes: 256 * 1024 },
      );
      return stdout;
    } catch {
      throw new ServiceUnavailableException(
        'GCP Secret Manager에서 환경 변수를 읽지 못했습니다.',
      );
    }
  }

  private extractVersion(name?: string): string {
    const version = name?.split('/').at(-1);
    this.assertVersion(version ?? '');
    return version!;
  }

  private assertVersion(version: string): void {
    if (!/^\d+$/.test(version)) {
      throw new ServiceUnavailableException(
        'GCP Secret Manager 버전 응답이 올바르지 않습니다.',
      );
    }
  }
}
