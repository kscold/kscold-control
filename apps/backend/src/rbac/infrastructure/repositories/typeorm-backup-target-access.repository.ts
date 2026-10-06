import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BackupTarget } from '../../../backup/domain/entities/backup-target.entity';
import { BackupTargetAccess } from '../../domain/entities/backup-target-access.entity';
import type {
  BackupTargetAssignment,
  BackupTargetScope,
  IBackupTargetAccessRepository,
} from '../../domain/repositories/backup-target-access.repository.interface';

@Injectable()
export class TypeOrmBackupTargetAccessRepository implements IBackupTargetAccessRepository {
  constructor(
    @InjectRepository(BackupTargetAccess)
    private readonly repository: Repository<BackupTargetAccess>,
    private readonly dataSource: DataSource,
  ) {}

  async findTargets(): Promise<BackupTargetScope[]> {
    const targets = await this.dataSource.getRepository(BackupTarget).find({
      select: { id: true, name: true, description: true },
      order: { name: 'ASC' },
    });

    return targets.map(({ id, name, description }) => ({
      id,
      name,
      description,
    }));
  }

  async findTargetIdsByUserId(userId: string): Promise<string[]> {
    const rows = await this.repository.find({
      select: { targetId: true },
      where: { userId },
      order: { targetId: 'ASC' },
    });
    return rows.map((row) => row.targetId);
  }

  async findAllAssignments(): Promise<BackupTargetAssignment[]> {
    const rows = await this.repository.find({
      select: { userId: true, targetId: true },
      order: { userId: 'ASC', targetId: 'ASC' },
    });
    const assignments = new Map<string, string[]>();
    for (const row of rows) {
      assignments.set(row.userId, [
        ...(assignments.get(row.userId) ?? []),
        row.targetId,
      ]);
    }
    return [...assignments].map(([userId, targetIds]) => ({
      userId,
      targetIds,
    }));
  }

  async replaceForUser(
    userId: string,
    targetIds: string[],
    grantedById: string,
  ): Promise<void> {
    // 지우고 다시 넣는 사이에 범위가 비어 보이지 않도록 한 트랜잭션으로 묶는다.
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(BackupTargetAccess);
      await repository.delete({ userId });
      if (targetIds.length === 0) return;

      await repository.insert(
        targetIds.map((targetId) => ({ userId, targetId, grantedById })),
      );
    });
  }
}
