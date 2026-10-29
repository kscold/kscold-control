import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StorageTrimRun } from '../../domain/entities/storage-trim-run.entity';
import type {
  FinishStorageTrimRunInput,
  IStorageTrimRunRepository,
  StartStorageTrimRunInput,
} from '../../domain/repositories/storage-trim-run.repository';

@Injectable()
export class TypeOrmStorageTrimRunRepository implements IStorageTrimRunRepository {
  constructor(
    @InjectRepository(StorageTrimRun)
    private readonly repository: Repository<StorageTrimRun>,
  ) {}

  start(input: StartStorageTrimRunInput): Promise<StorageTrimRun> {
    return this.repository.save(
      this.repository.create({
        trigger: input.trigger,
        status: 'running',
        message: '',
        allocatedBeforeBytes: null,
        allocatedAfterBytes: null,
        trimmedBytes: null,
        actorEmail: input.actorEmail,
        startedAt: new Date(),
        finishedAt: null,
      }),
    );
  }

  async finish(
    id: string,
    input: FinishStorageTrimRunInput,
  ): Promise<StorageTrimRun> {
    await this.repository.update(id, { ...input, finishedAt: new Date() });
    return this.repository.findOneByOrFail({ id });
  }

  listRecent(limit: number): Promise<StorageTrimRun[]> {
    return this.repository.find({ order: { startedAt: 'DESC' }, take: limit });
  }

  findLatestScheduled(): Promise<StorageTrimRun | null> {
    return this.repository.findOne({
      where: { trigger: 'schedule' },
      order: { startedAt: 'DESC' },
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
