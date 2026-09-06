import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type {
  DeploymentProvider,
  GithubActionsDeploymentConfig,
  GcpSecretStoreConfig,
  SecretStoreProvider,
  SshBlueGreenDeploymentConfig,
  SshSecretStoreConfig,
} from '../types/key-management-target.type';

@Entity('key_management_targets')
@Index('idx_key_management_targets_enabled_sort', ['enabled', 'sortOrder'])
export class KeyManagementTargetEntity {
  @PrimaryColumn({ type: 'varchar', length: 80 })
  id: string;

  @Column({ name: 'display_name', type: 'varchar', length: 120 })
  displayName: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 32 })
  environment: string;

  @Column({ type: 'varchar', length: 32 })
  provider: SecretStoreProvider;

  @Column({ name: 'deployment_provider', type: 'varchar', length: 32 })
  deploymentProvider: DeploymentProvider;

  @Column({ name: 'env_file_name', type: 'varchar', length: 120 })
  envFileName: string;

  @Column({ name: 'instance_name', type: 'varchar', length: 160 })
  instanceName: string;

  @Column({ type: 'varchar', length: 160 })
  location: string;

  @Column({
    name: 'required_keys',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  requiredKeys: string[];

  @Column({ name: 'secret_config', type: 'jsonb', select: false })
  secretConfig: GcpSecretStoreConfig | SshSecretStoreConfig;

  @Column({ name: 'deployment_config', type: 'jsonb', select: false })
  deploymentConfig:
    GithubActionsDeploymentConfig | SshBlueGreenDeploymentConfig;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ name: 'sort_order', type: 'smallint', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
