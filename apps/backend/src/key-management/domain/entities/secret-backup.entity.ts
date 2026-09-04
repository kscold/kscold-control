import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SecretBackupOperation = 'update' | 'patch' | 'restore';
export type SecretBackupStatus =
  | 'backed_up'
  | 'secret_created'
  | 'deployment_queued'
  | 'deployment_running'
  | 'deployed'
  | 'failed';

@Entity('secret_backups')
export class SecretBackup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'target_id', length: 80 })
  targetId: string;

  @Column({ length: 20 })
  operation: SecretBackupOperation;

  @Column({ name: 'source_version', length: 64 })
  sourceVersion: string;

  @Column({ name: 'new_version', length: 64, nullable: true })
  newVersion: string | null;

  @Column({ length: 64 })
  checksum: string;

  @Column({ name: 'changed_keys', type: 'jsonb', default: () => "'[]'::jsonb" })
  changedKeys: string[];

  @Column({ name: 'encrypted_payload', type: 'text', select: false })
  encryptedPayload: string;

  @Column({ type: 'varchar', length: 64, select: false })
  iv: string;

  @Column({ name: 'auth_tag', type: 'varchar', length: 64, select: false })
  authTag: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ name: 'actor_email', type: 'varchar', length: 320, nullable: true })
  actorEmail: string | null;

  @Index()
  @Column({ length: 32, default: 'backed_up' })
  status: SecretBackupStatus;

  @Column({ name: 'deployment_request_id', type: 'uuid', nullable: true })
  deploymentRequestId: string | null;

  @Column({
    name: 'deployment_run_id',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  deploymentRunId: string | null;

  @Column({ name: 'deployment_url', type: 'text', nullable: true })
  deploymentUrl: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'restored_from_backup_id', type: 'uuid', nullable: true })
  restoredFromBackupId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
