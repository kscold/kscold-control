import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  IKeyManagementTargetRepository,
  KEY_MANAGEMENT_TARGET_REPOSITORY,
} from '../../domain/repositories/key-management-target.repository.interface';
import type {
  GithubActionsDeploymentConfig,
  GcpSecretStoreConfig,
  KeyManagementTarget,
  SshBlueGreenDeploymentConfig,
  SshSecretStoreConfig,
} from '../../domain/types/key-management-target.type';

const TARGET_ID = /^[a-z0-9][a-z0-9-]{1,79}$/;
const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SAFE_HOST =
  /^(?:[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?|\[[0-9a-f:]+\])$/i;
const SAFE_USERNAME = /^[a-z_][a-z0-9_-]{0,31}$/i;
const SAFE_PATH = /^\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/;
const SAFE_CREDENTIAL_REF = /^[a-z0-9][a-z0-9-]{1,79}$/;
const SAFE_REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SAFE_WORKFLOW = /^[A-Za-z0-9_.-]+\.ya?ml$/;
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/;

@Injectable()
export class KeyManagementTargetService {
  constructor(
    @Inject(KEY_MANAGEMENT_TARGET_REPOSITORY)
    private readonly repository: IKeyManagementTargetRepository,
  ) {}

  async list(): Promise<KeyManagementTarget[]> {
    const targets = await this.repository.findEnabled();
    return targets.map((target) => this.validateAndMap(target));
  }

  async get(targetId: string): Promise<KeyManagementTarget> {
    if (!TARGET_ID.test(targetId)) {
      throw new NotFoundException('지원하지 않는 키 관리 대상입니다.');
    }
    const target = await this.repository.findEnabledById(targetId);
    if (!target) {
      throw new NotFoundException('지원하지 않는 키 관리 대상입니다.');
    }
    return this.validateAndMap(target);
  }

  private validateAndMap(input: KeyManagementTarget): KeyManagementTarget {
    try {
      if (
        !TARGET_ID.test(input.id) ||
        !input.displayName ||
        !input.description ||
        !input.environment ||
        !input.envFileName ||
        !input.instanceName ||
        !input.location ||
        !Array.isArray(input.requiredKeys) ||
        input.requiredKeys.length === 0 ||
        input.requiredKeys.length > 256 ||
        new Set(input.requiredKeys).size !== input.requiredKeys.length ||
        !input.requiredKeys.every((key) => ENV_KEY.test(key))
      ) {
        throw new Error('invalid target metadata');
      }

      if (input.provider === 'gcp-secret-manager') {
        this.assertGcpConfig(input.secretConfig as GcpSecretStoreConfig);
      } else if (input.provider === 'ssh-env-file') {
        this.assertSshConfig(input.secretConfig as SshSecretStoreConfig);
      } else {
        throw new Error('invalid secret provider');
      }

      if (input.deploymentProvider === 'github-actions') {
        this.assertGithubConfig(
          input.deploymentConfig as GithubActionsDeploymentConfig,
        );
      } else if (input.deploymentProvider === 'ssh-blue-green') {
        this.assertSshDeploymentConfig(
          input.deploymentConfig as SshBlueGreenDeploymentConfig,
        );
      } else {
        throw new Error('invalid deployment provider');
      }

      if (
        (input.provider === 'gcp-secret-manager' &&
          input.deploymentProvider !== 'github-actions') ||
        (input.provider === 'ssh-env-file' &&
          input.deploymentProvider !== 'ssh-blue-green')
      ) {
        throw new Error('invalid provider pairing');
      }
    } catch {
      throw new ServiceUnavailableException(
        `키 관리 대상 ${input.id} 설정이 올바르지 않습니다.`,
      );
    }

    return {
      id: input.id,
      displayName: input.displayName,
      description: input.description,
      environment: input.environment,
      provider: input.provider,
      deploymentProvider: input.deploymentProvider,
      envFileName: input.envFileName,
      instanceName: input.instanceName,
      location: input.location,
      requiredKeys: [...input.requiredKeys],
      secretConfig: { ...input.secretConfig },
      deploymentConfig: { ...input.deploymentConfig },
      enabled: input.enabled,
      sortOrder: input.sortOrder,
    };
  }

  private assertGcpConfig(config: GcpSecretStoreConfig): void {
    if (
      !config ||
      !/^[A-Za-z0-9][A-Za-z0-9:._-]{2,254}$/.test(config.projectId) ||
      !/^[A-Za-z0-9][A-Za-z0-9_-]{1,254}$/.test(config.secretName) ||
      !/^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/.test(
        config.serviceAccount,
      )
    ) {
      throw new Error('invalid GCP config');
    }
  }

  private assertSshConfig(config: SshSecretStoreConfig): void {
    if (
      !config ||
      !SAFE_HOST.test(config.host) ||
      !Number.isInteger(config.port) ||
      config.port < 1 ||
      config.port > 65_535 ||
      !SAFE_USERNAME.test(config.username) ||
      !SAFE_PATH.test(config.envPath) ||
      !SAFE_CREDENTIAL_REF.test(config.credentialRef)
    ) {
      throw new Error('invalid SSH config');
    }
  }

  private assertGithubConfig(config: GithubActionsDeploymentConfig): void {
    if (
      !config ||
      !SAFE_REPOSITORY.test(config.repository) ||
      !SAFE_WORKFLOW.test(config.workflow) ||
      !SAFE_REF.test(config.ref)
    ) {
      throw new Error('invalid GitHub config');
    }
  }

  private assertSshDeploymentConfig(
    config: SshBlueGreenDeploymentConfig,
  ): void {
    if (
      !config ||
      !SAFE_PATH.test(config.workingDirectory) ||
      !/^[A-Za-z0-9._-]{1,120}$/.test(config.script) ||
      !SAFE_PATH.test(config.statusDirectory)
    ) {
      throw new Error('invalid SSH deployment config');
    }
  }
}
