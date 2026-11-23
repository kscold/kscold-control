import {
  BadRequestException,
  ConflictException,
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
  SshConnectionConfig,
  SshEnvCommandSecretStoreConfig,
  SshEnvCommandDeploymentConfig,
} from '../../domain/types/key-management-target.type';
import {
  acceptsAnyEnvKey,
  isReservedEnvKey,
} from '../../domain/policies/env-command-key.policy';

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

  /** 새 대상을 등록한다. 기존 대상과 같은 규칙으로 검사하고, 틀린 곳을 문장으로 알려 준다. */
  async create(input: KeyManagementTarget): Promise<KeyManagementTarget> {
    if (!TARGET_ID.test(input.id)) {
      throw new BadRequestException(
        'ID 는 영문 소문자·숫자·- 로 2~80자여야 합니다.',
      );
    }
    if (await this.repository.exists(input.id)) {
      throw new ConflictException(`이미 있는 대상 ID 입니다: ${input.id}`);
    }
    try {
      this.assertValid(input);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    const target = { ...input, enabled: true };
    await this.repository.create(target);
    return this.validateAndMap(target);
  }

  async disable(targetId: string): Promise<void> {
    if (
      !TARGET_ID.test(targetId) ||
      !(await this.repository.disable(targetId))
    ) {
      throw new NotFoundException('켜져 있는 키 관리 대상이 아닙니다.');
    }
  }

  private validateAndMap(input: KeyManagementTarget): KeyManagementTarget {
    try {
      this.assertValid(input);
    } catch {
      throw new ServiceUnavailableException(
        `키 관리 대상 ${input.id} 설정이 올바르지 않습니다.`,
      );
    }
    return this.toTarget(input);
  }

  private assertValid(input: KeyManagementTarget): void {
    {
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
        throw new Error(
          'ID·이름·설명·환경·파일 이름·인스턴스·위치와 필수 키(영문 대문자·숫자·_, 1~256개, 중복 없음)를 확인해 주세요.',
        );
      }

      if (input.provider === 'gcp-secret-manager') {
        this.assertGcpConfig(input.secretConfig as GcpSecretStoreConfig);
      } else if (input.provider === 'ssh-env-file') {
        this.assertSshConfig(input.secretConfig as SshSecretStoreConfig);
      } else if (input.provider === 'ssh-env-command') {
        this.assertCommandConfig(
          input.secretConfig as SshEnvCommandSecretStoreConfig,
          input.requiredKeys,
        );
      } else {
        throw new Error('지원하지 않는 비밀값 저장 방식입니다.');
      }

      if (input.deploymentProvider === 'github-actions') {
        this.assertGithubConfig(
          input.deploymentConfig as GithubActionsDeploymentConfig,
        );
      } else if (input.deploymentProvider === 'ssh-blue-green') {
        this.assertSshDeploymentConfig(
          input.deploymentConfig as SshBlueGreenDeploymentConfig,
        );
      } else if (input.deploymentProvider === 'ssh-env-command') {
        const config = input.deploymentConfig as SshEnvCommandDeploymentConfig;
        if (
          !config ||
          config.protocol !== 'env-v1' ||
          Object.keys(config).some((key) => key !== 'protocol')
        )
          throw new Error('명령형 배포 설정이 올바르지 않습니다.');
      } else {
        throw new Error('지원하지 않는 배포 방식입니다.');
      }

      if (
        (input.provider === 'gcp-secret-manager' &&
          input.deploymentProvider !== 'github-actions') ||
        (input.provider === 'ssh-env-file' &&
          input.deploymentProvider !== 'ssh-blue-green') ||
        (input.provider === 'ssh-env-command' &&
          input.deploymentProvider !== 'ssh-env-command')
      ) {
        throw new Error(
          '비밀값 저장 방식과 배포 방식의 짝이 맞지 않습니다(GCP↔GitHub Actions, SSH 파일↔SSH 블루그린, SSH 명령↔SSH 명령).',
        );
      }
    }
  }

  private toTarget(input: KeyManagementTarget): KeyManagementTarget {
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
      throw new Error(
        'GCP 프로젝트 ID·비밀 이름·서비스 계정(…@….iam.gserviceaccount.com)을 확인해 주세요.',
      );
    }
  }

  private assertSshConfig(config: SshSecretStoreConfig): void {
    this.assertConnection(config);
    if (!SAFE_PATH.test(config.envPath))
      throw new Error('원격 .env 경로는 /로 시작하는 전체 경로여야 합니다.');
  }

  private assertConnection(config: SshConnectionConfig): void {
    if (
      !config ||
      !SAFE_HOST.test(config.host) ||
      !Number.isInteger(config.port) ||
      config.port < 1 ||
      config.port > 65_535 ||
      !SAFE_USERNAME.test(config.username) ||
      !SAFE_CREDENTIAL_REF.test(config.credentialRef)
    ) {
      throw new Error(
        'SSH 호스트·포트·사용자·키 이름(영문 소문자·숫자·-)을 확인해 주세요.',
      );
    }
  }

  private assertCommandConfig(
    config: SshEnvCommandSecretStoreConfig,
    requiredKeys: string[],
  ): void {
    this.assertConnection(config);
    // ['*'] 는 예약 키를 뺀 모든 키를 관리한다는 뜻 (서버도 같은 규칙으로 다시 검사)
    const anyKey =
      Array.isArray(config.allowedKeys) && acceptsAnyEnvKey(config.allowedKeys);
    const reservedRequired = anyKey
      ? requiredKeys.filter((key) => isReservedEnvKey(key))
      : [];
    if (reservedRequired.length > 0) {
      throw new Error(
        `모든 키(*)를 관리하는 대상은 배포 도구가 정하는 예약 키를 필수 키로 둘 수 없습니다: ${reservedRequired.join(', ')}`,
      );
    }
    const missingAllowed =
      !anyKey && Array.isArray(config.allowedKeys)
        ? requiredKeys.filter((key) => !config.allowedKeys.includes(key))
        : [];
    if (missingAllowed.length > 0) {
      throw new Error(
        `필수 키가 관리할 키 목록에 없습니다: ${missingAllowed.join(', ')}`,
      );
    }
    if (
      config.protocol !== 'env-v1' ||
      !Array.isArray(config.allowedKeys) ||
      !config.allowedKeys.length ||
      config.allowedKeys.length > 256 ||
      new Set(config.allowedKeys).size !== config.allowedKeys.length ||
      (!anyKey &&
        !config.allowedKeys.every(
          (key) =>
            ENV_KEY.test(key) &&
            !/^(?:PATH|NODE_OPTIONS|LD_.*|DYLD_.*|BASH_ENV|ENV|SHELLOPTS|NODE_PATH)$/.test(
              key,
            ),
        )) ||
      (anyKey
        ? requiredKeys.some((key) => isReservedEnvKey(key))
        : !requiredKeys.every((key) => config.allowedKeys.includes(key))) ||
      Object.keys(config).some(
        (key) =>
          ![
            'host',
            'port',
            'username',
            'credentialRef',
            'protocol',
            'allowedKeys',
          ].includes(key),
      )
    )
      throw new Error(
        '허용 키 목록을 확인해 주세요. 필수 키는 모두 허용 키에 있어야 하고 PATH 같은 위험한 키는 쓸 수 없습니다.',
      );
  }

  private assertGithubConfig(config: GithubActionsDeploymentConfig): void {
    if (
      !config ||
      !SAFE_REPOSITORY.test(config.repository) ||
      !SAFE_WORKFLOW.test(config.workflow) ||
      !SAFE_REF.test(config.ref)
    ) {
      throw new Error(
        'GitHub 저장소(owner/name)·워크플로 파일(.yml)·브랜치를 확인해 주세요.',
      );
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
      throw new Error(
        '배포 작업 폴더·스크립트 이름·상태 폴더를 확인해 주세요.',
      );
    }
  }
}
