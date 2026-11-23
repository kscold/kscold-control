import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type {
  DeploymentProvider,
  SecretStoreProvider,
} from '../../domain/types/key-management-target.type';

/**
 * 운영 키 대상 등록 요청. 모양만 여기서 보고,
 * 저장 방식별 세부 규칙은 KeyManagementTargetService 가 기존 대상과 같은 규칙으로 검사한다.
 */
export class CreateKeyManagementTargetDto {
  @IsString()
  @MaxLength(80)
  id: string;

  @IsString()
  @MaxLength(120)
  displayName: string;

  @IsString()
  @MaxLength(500)
  description: string;

  @IsString()
  @MaxLength(32)
  environment: string;

  @IsIn(['gcp-secret-manager', 'ssh-env-file', 'ssh-env-command'])
  provider: SecretStoreProvider;

  @IsIn(['github-actions', 'ssh-blue-green', 'ssh-env-command'])
  deploymentProvider: DeploymentProvider;

  @IsString()
  @MaxLength(120)
  envFileName: string;

  @IsString()
  @MaxLength(160)
  instanceName: string;

  @IsString()
  @MaxLength(160)
  location: string;

  @IsArray()
  @ArrayMaxSize(256)
  @IsString({ each: true })
  requiredKeys: string[];

  @IsObject()
  secretConfig: Record<string, unknown>;

  @IsObject()
  deploymentConfig: Record<string, unknown>;

  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder: number;
}
