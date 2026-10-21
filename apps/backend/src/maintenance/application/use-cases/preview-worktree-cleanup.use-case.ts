import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  WORKTREE_CLEANUP_TARGET_REPOSITORY,
  type IWorktreeCleanupTargetRepository,
} from '../../domain/repositories/worktree-cleanup-target.repository';
import {
  WorktreeCleanupRunnerService,
  type WorktreeCleanupPlan,
} from '../services/worktree-cleanup-runner.service';

/** 지금 정리하면 무엇을 남기고 무엇을 지울지 미리 본다. 아무것도 지우지 않는다. */
@Injectable()
export class PreviewWorktreeCleanupUseCase {
  constructor(
    @Inject(WORKTREE_CLEANUP_TARGET_REPOSITORY)
    private readonly targetRepository: IWorktreeCleanupTargetRepository,
    private readonly runner: WorktreeCleanupRunnerService,
  ) {}

  async execute(targetId: string): Promise<WorktreeCleanupPlan> {
    const target = await this.targetRepository.findById(targetId);
    if (!target) {
      throw new NotFoundException('등록되지 않은 정리 대상입니다.');
    }
    return this.runner.plan(target);
  }
}
