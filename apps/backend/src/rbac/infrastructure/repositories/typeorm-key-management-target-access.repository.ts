import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { KeyManagementTargetEntity } from '../../../key-management/domain/entities/key-management-target.entity';
import { KeyManagementTargetAccess } from '../../domain/entities/key-management-target-access.entity';
import {
  IKeyManagementTargetAccessRepository,
  KeyManagementTargetAssignment,
  KeyManagementTargetScope,
} from '../../domain/repositories/key-management-target-access.repository.interface';

@Injectable()
export class TypeOrmKeyManagementTargetAccessRepository implements IKeyManagementTargetAccessRepository {
  constructor(
    @InjectRepository(KeyManagementTargetAccess)
    private readonly repository: Repository<KeyManagementTargetAccess>,
    private readonly dataSource: DataSource,
  ) {}

  async findEnabledTargets(): Promise<KeyManagementTargetScope[]> {
    const targets = await this.dataSource
      .getRepository(KeyManagementTargetEntity)
      .find({
        select: { id: true, displayName: true, environment: true },
        where: { enabled: true },
        order: { sortOrder: 'ASC', id: 'ASC' },
      });

    return targets.map(({ id, displayName, environment }) => ({
      id,
      displayName,
      environment,
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

  async findAllAssignments(): Promise<KeyManagementTargetAssignment[]> {
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
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(KeyManagementTargetAccess);
      await repository.delete({ userId });
      if (targetIds.length === 0) return;

      await repository.insert(
        targetIds.map((targetId) => ({
          userId,
          targetId,
          grantedById,
        })),
      );
    });
  }
}
