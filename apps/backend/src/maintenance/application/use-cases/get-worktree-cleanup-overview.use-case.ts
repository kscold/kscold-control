import { Inject, Injectable } from '@nestjs/common';
import {
  DAILY_SCHEDULE_TIME_ZONE,
  resolveNextRunAt,
} from '../../../common/scheduling/daily-schedule.policy';
import type { WorktreeCleanupRun } from '../../domain/entities/worktree-cleanup-run.entity';
import type { WorktreeCleanupTarget } from '../../domain/entities/worktree-cleanup-target.entity';
import {
  WORKTREE_CLEANUP_RUN_REPOSITORY,
  type IWorktreeCleanupRunRepository,
} from '../../domain/repositories/worktree-cleanup-run.repository';
import {
  WORKTREE_CLEANUP_TARGET_REPOSITORY,
  type IWorktreeCleanupTargetRepository,
} from '../../domain/repositories/worktree-cleanup-target.repository';
import { WorktreeCleanupRunnerService } from '../services/worktree-cleanup-runner.service';

export interface WorktreeCleanupTargetStatus {
  target: WorktreeCleanupTarget;
  running: boolean;
  nextRunAt: Date | null;
  lastRun: WorktreeCleanupRun | null;
}

/**
 * 정리 대상과 대상별 일정·최근 실행 조회
 * 폴더를 살펴보는 일은 무거워 여기서는 하지 않는다 (미리보기에서 대상별로 한다).
 */
@Injectable()
export class GetWorktreeCleanupOverviewUseCase {
  constructor(
    @Inject(WORKTREE_CLEANUP_TARGET_REPOSITORY)
    private readonly targetRepository: IWorktreeCleanupTargetRepository,
    @Inject(WORKTREE_CLEANUP_RUN_REPOSITORY)
    private readonly runRepository: IWorktreeCleanupRunRepository,
    private readonly runner: WorktreeCleanupRunnerService,
  ) {}

  async execute(now: Date = new Date()) {
    const targets = await this.targetRepository.findAll();
    const latest = await this.runRepository.findLatestByTargetIds(
      targets.map((target) => target.id),
    );
    const items: WorktreeCleanupTargetStatus[] = targets.map((target) => ({
      target,
      running: this.runner.isRunning(target.id),
      nextRunAt: resolveNextRunAt(target, now),
      lastRun: latest.get(target.id) ?? null,
    }));
    return { timeZone: DAILY_SCHEDULE_TIME_ZONE, items };
  }
}
