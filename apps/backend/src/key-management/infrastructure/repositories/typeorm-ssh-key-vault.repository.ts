import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SshKeyVaultEntry } from '../../domain/entities/ssh-key-vault.entity';
import type { ISshKeyVaultRepository } from '../../domain/repositories/ssh-key-vault.repository.interface';

@Injectable()
export class TypeOrmSshKeyVaultRepository implements ISshKeyVaultRepository {
  constructor(
    @InjectRepository(SshKeyVaultEntry)
    private readonly repository: Repository<SshKeyVaultEntry>,
  ) {}

  findAll(): Promise<SshKeyVaultEntry[]> {
    return this.repository.find({ order: { name: 'ASC' } });
  }

  findByName(name: string): Promise<SshKeyVaultEntry | null> {
    return this.repository.findOne({ where: { name } });
  }

  findByIdWithSecret(id: string): Promise<SshKeyVaultEntry | null> {
    return this.repository
      .createQueryBuilder('entry')
      .addSelect([
        'entry.encryptedPrivateKey',
        'entry.privateKeyIv',
        'entry.privateKeyAuthTag',
      ])
      .where('entry.id = :id', { id })
      .getOne();
  }

  save(entry: Partial<SshKeyVaultEntry>): Promise<SshKeyVaultEntry> {
    return this.repository.save(this.repository.create(entry));
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
