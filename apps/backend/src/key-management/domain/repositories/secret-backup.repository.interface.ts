import { SecretBackup } from '../entities/secret-backup.entity';

export interface ISecretBackupRepository {
  create(data: Partial<SecretBackup>): SecretBackup;
  save(backup: SecretBackup): Promise<SecretBackup>;
  findRecent(targetId: string, limit: number): Promise<SecretBackup[]>;
  findByIdWithPayload(id: string): Promise<SecretBackup | null>;
}

export const SECRET_BACKUP_REPOSITORY = Symbol('SECRET_BACKUP_REPOSITORY');
