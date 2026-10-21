import { Inject, Injectable } from '@nestjs/common';
import type { WorktreeCleanupRun } from '../../domain/entities/worktree-cleanup-run.entity';
import {
  WORKTREE_CLEANUP_RUN_REPOSITORY,
  type IWorktreeCleanupRunRepository,
} from '../../domain/repositories/worktree-cleanup-run.repository';
import type { WorktreeCleanupActor } from '../../domain/types/worktree.type';
import { WorktreeCleanupRunnerService } from '../services/worktree-cleanup-runner.service';

/** 지금 정리 시작 — 실행 기록만 먼저 돌려주고 정리는 뒤에서 이어진다 */
@Injectable()
export class RunWorktreeCleanupUseCase {
  constructor(private readonly runner: WorktreeCleanupRunnerService) {}

  execute(
    targetId: string,
    actor: WorktreeCleanupActor,
  ): Promise<WorktreeCleanupRun> {
    return this.runner.start(targetId, 'manual', actor);
  }
}

/** 정리 실행 이력 — 최근 실행부터 */
@Injectable()
export class ListWorktreeCleanupRunsUseCase {
  constructor(
    @Inject(WORKTREE_CLEANUP_RUN_REPOSITORY)
    private readonly runRepository: IWorktreeCleanupRunRepository,
  ) {}

  execute(params: { targetId?: string; limit?: number } = {}) {
    return this.runRepository.findRecent({
      targetId: params.targetId,
      limit: params.limit ?? 30,
    });
  }
}
