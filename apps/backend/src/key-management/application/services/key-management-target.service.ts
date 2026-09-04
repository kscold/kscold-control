import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KeyManagementTarget } from '../../domain/types/key-management-target.type';

@Injectable()
export class KeyManagementTargetService {
  private readonly target: KeyManagementTarget;

  constructor(config: ConfigService) {
    this.target = {
      id: 'projectalpha-production',
      displayName: 'ProjectAlpha Production',
      provider: 'gcp-secret-manager',
      projectId:
        config.get<string>('KEY_MANAGEMENT_GCP_PROJECT_ID') ??
        'example-project',
      secretName:
        config.get<string>('KEY_MANAGEMENT_GCP_SECRET_NAME') ??
        'projectalpha-production-env',
      instanceName:
        config.get<string>('KEY_MANAGEMENT_GCP_INSTANCE') ?? 'projectalpha-production',
      zone:
        config.get<string>('KEY_MANAGEMENT_GCP_ZONE') ?? 'asia-northeast3-a',
      repository:
        config.get<string>('KEY_MANAGEMENT_GITHUB_REPOSITORY') ??
        'example-org/projectalpha',
      workflow:
        config.get<string>('KEY_MANAGEMENT_GITHUB_WORKFLOW') ??
        'secret-sync.yml',
      ref: config.get<string>('KEY_MANAGEMENT_GITHUB_REF') ?? 'main',
    };
  }

  list(): KeyManagementTarget[] {
    return [{ ...this.target }];
  }

  get(targetId: string): KeyManagementTarget {
    if (targetId !== this.target.id) {
      throw new NotFoundException('지원하지 않는 키 관리 대상입니다.');
    }
    return { ...this.target };
  }
}
