import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorktreeCleanupTarget } from '../../domain/entities/worktree-cleanup-target.entity';
import type {
  CreateWorktreeCleanupTargetInput,
  IWorktreeCleanupTargetRepository,
  UpdateWorktreeCleanupTargetInput,
} from '../../domain/repositories/worktree-cleanup-target.repository';

@Injectable()
export class TypeOrmWorktreeCleanupTargetRepository implements IWorktreeCleanupTargetRepository {
  constructor(
    @InjectRepository(WorktreeCleanupTarget)
    private readonly repository: Repository<WorktreeCleanupTarget>,
  ) {}

  findAll(): Promise<WorktreeCleanupTarget[]> {
    return this.repository.find({ order: { name: 'ASC' } });
  }

  findEnabled(): Promise<WorktreeCleanupTarget[]> {
    return this.repository.find({
      where: { enabled: true },
      order: { name: 'ASC' },
    });
  }

  findById(id: string): Promise<WorktreeCleanupTarget | null> {
    return this.repository.findOne({ where: { id } });
  }

  findByNameOrRoot(
    name: string,
    rootPath: string,
  ): Promise<WorktreeCleanupTarget | null> {
    return this.repository.findOne({ where: [{ name }, { rootPath }] });
  }

  create(
    input: CreateWorktreeCleanupTargetInput,
  ): Promise<WorktreeCleanupTarget> {
    return this.repository.save(this.repository.create(input));
  }

  async update(
    id: string,
    input: UpdateWorktreeCleanupTargetInput,
  ): Promise<WorktreeCleanupTarget | null> {
    if (Object.keys(input).length > 0) {
      await this.repository.update({ id }, input);
    }
    return this.findById(id);
  }

  async moveScheduleCursor(id: string, at: Date): Promise<void> {
    // 예약 실행은 설정 변경이 아니므로 수정 시각을 건드리지 않도록 직접 쓴다.
    await this.repository.query(
      'UPDATE worktree_cleanup_targets SET schedule_cursor_at = $1 WHERE id = $2',
      [at, id],
    );
  }

  async remove(id: string): Promise<void> {
    await this.repository.delete({ id });
  }
}
