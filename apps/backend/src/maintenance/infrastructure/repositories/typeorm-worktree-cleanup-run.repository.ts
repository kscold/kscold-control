import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorktreeCleanupRun } from '../../domain/entities/worktree-cleanup-run.entity';
import type {
  FinishWorktreeCleanupRunInput,
  IWorktreeCleanupRunRepository,
  StartWorktreeCleanupRunInput,
} from '../../domain/repositories/worktree-cleanup-run.repository';

@Injectable()
export class TypeOrmWorktreeCleanupRunRepository implements IWorktreeCleanupRunRepository {
  constructor(
    @InjectRepository(WorktreeCleanupRun)
    private readonly repository: Repository<WorktreeCleanupRun>,
  ) {}

  start(input: StartWorktreeCleanupRunInput): Promise<WorktreeCleanupRun> {
    return this.repository.save(
      this.repository.create({
        targetId: input.targetId,
        trigger: input.trigger,
        status: 'running',
        message: '',
        removed: [],
        kept: [],
        freedBytes: 0,
        diskReclaimedBytes: null,
        actorId: input.actor?.id ?? null,
        actorEmail: input.actor?.email ?? null,
        startedAt: new Date(),
        finishedAt: null,
      }),
    );
  }

  async finish(
    id: string,
    input: FinishWorktreeCleanupRunInput,
  ): Promise<WorktreeCleanupRun> {
    await this.repository.update({ id }, { ...input, finishedAt: new Date() });
    return this.repository.findOneOrFail({ where: { id } });
  }

  async findLatestByTargetIds(
    targetIds: string[],
  ): Promise<Map<string, WorktreeCleanupRun>> {
    if (targetIds.length === 0) return new Map();
    const runs = await this.repository
      .createQueryBuilder('run')
      .distinctOn(['run.targetId'])
      .where('run.targetId IN (:...targetIds)', { targetIds })
      .orderBy('run.targetId')
      .addOrderBy('run.startedAt', 'DESC')
      .getMany();
    return new Map(runs.map((run) => [run.targetId, run]));
  }

  findRecent(options: {
    targetId?: string;
    limit: number;
  }): Promise<WorktreeCleanupRun[]> {
    return this.repository.find({
      where: options.targetId ? { targetId: options.targetId } : {},
      relations: { target: true },
      order: { startedAt: 'DESC' },
      take: options.limit,
    });
  }

  async failUnfinished(message: string): Promise<number> {
    const result = await this.repository.update(
      { status: 'running' },
      { status: 'failed', message, finishedAt: new Date() },
    );
    return result.affected ?? 0;
  }
}
