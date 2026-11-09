import type { SshKeyVaultEntry } from '../entities/ssh-key-vault.entity';

export const SSH_KEY_VAULT_REPOSITORY = Symbol('SSH_KEY_VAULT_REPOSITORY');

export interface ISshKeyVaultRepository {
  findAll(): Promise<SshKeyVaultEntry[]>;
  findByName(name: string): Promise<SshKeyVaultEntry | null>;
  findByIdWithSecret(id: string): Promise<SshKeyVaultEntry | null>;
  save(entry: Partial<SshKeyVaultEntry>): Promise<SshKeyVaultEntry>;
  delete(id: string): Promise<boolean>;
}
