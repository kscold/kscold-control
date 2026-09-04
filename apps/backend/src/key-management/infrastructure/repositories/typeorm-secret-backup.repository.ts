import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecretBackup } from '../../domain/entities/secret-backup.entity';
import { ISecretBackupRepository } from '../../domain/repositories/secret-backup.repository.interface';

@Injectable()
export class TypeOrmSecretBackupRepository implements ISecretBackupRepository {
  constructor(
    @InjectRepository(SecretBackup)
    private readonly repository: Repository<SecretBackup>,
  ) {}

  create(data: Partial<SecretBackup>): SecretBackup {
    return this.repository.create(data);
  }

  save(backup: SecretBackup): Promise<SecretBackup> {
    return this.repository.save(backup);
  }

  findRecent(targetId: string, limit: number): Promise<SecretBackup[]> {
    return this.repository.find({
      where: { targetId },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  findByIdWithPayload(id: string): Promise<SecretBackup | null> {
    return this.repository
      .createQueryBuilder('backup')
      .addSelect(['backup.encryptedPayload', 'backup.iv', 'backup.authTag'])
      .where('backup.id = :id', { id })
      .getOne();
  }
}
