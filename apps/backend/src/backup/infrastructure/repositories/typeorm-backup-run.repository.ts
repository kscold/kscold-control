import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BackupRun } from '../../domain/entities/backup-run.entity';
import type {
  FindBackupRunsOptions,
  FinishBackupRunInput,
  IBackupRunRepository,
  StartBackupRunInput,
} from '../../domain/repositories/backup-run.repository';

@Injectable()
export class TypeOrmBackupRunRepository implements IBackupRunRepository {
  constructor(
    @InjectRepository(BackupRun)
    private readonly repository: Repository<BackupRun>,
  ) {}

  start(input: StartBackupRunInput): Promise<BackupRun> {
    return this.repository.save(
      this.repository.create({
        targetId: input.targetId,
        trigger: input.trigger,
        status: 'running',
        message: '',
        archivePath: null,
        archiveSizeBytes: null,
        pruned: [],
        actorId: input.actor?.id ?? null,
        actorEmail: input.actor?.email ?? null,
        startedAt: new Date(),
        finishedAt: null,
      }),
    );
  }

  async finish(id: string, input: FinishBackupRunInput): Promise<BackupRun> {
    await this.repository.update({ id }, { ...input, finishedAt: new Date() });
    return this.repository.findOneOrFail({ where: { id } });
  }

  async findLatestByTargetIds(
    targetIds: string[],
  ): Promise<Map<string, BackupRun>> {
    if (targetIds.length === 0) {
      return new Map();
    }

    // 대상마다 가장 최근 실행 한 건만 고른다.
    const runs = await this.repository
      .createQueryBuilder('run')
      .distinctOn(['run.targetId'])
      .where('run.targetId IN (:...targetIds)', { targetIds })
      .orderBy('run.targetId')
      .addOrderBy('run.startedAt', 'DESC')
      .getMany();

    return new Map(runs.map((run) => [run.targetId, run]));
  }

  findRecent(options: FindBackupRunsOptions): Promise<BackupRun[]> {
    return this.repository.find({
      where: options.targetId
        ? { targetId: options.targetId }
        : options.targetIds
          ? { targetId: In(options.targetIds) }
          : {},
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
