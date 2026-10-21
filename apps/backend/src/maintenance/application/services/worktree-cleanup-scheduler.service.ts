import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { isDailyScheduleDue } from '../../../common/scheduling/daily-schedule.policy';
import {
  WORKTREE_CLEANUP_TARGET_REPOSITORY,
  type IWorktreeCleanupTargetRepository,
} from '../../domain/repositories/worktree-cleanup-target.repository';
import { WorktreeCleanupRunnerService } from './worktree-cleanup-runner.service';

/**
 * 작업 폴더 정리 스케줄러
 * 백업과 같은 방식으로 1분마다 깨어나 차례가 된 대상을 찾는다.
 */
@Injectable()
export class WorktreeCleanupSchedulerService {
  private readonly logger = new Logger(WorktreeCleanupSchedulerService.name);
  private checking = false;

  constructor(
    @Inject(WORKTREE_CLEANUP_TARGET_REPOSITORY)
    private readonly targetRepository: IWorktreeCleanupTargetRepository,
    private readonly runner: WorktreeCleanupRunnerService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'worktree-cleanup-schedule' })
  async handleTick(): Promise<void> {
    if (this.checking) return;
    this.checking = true;
    try {
      await this.runDueTargets(new Date());
    } catch (error) {
      this.logger.error(`[작업 폴더 정리] 예약 점검 실패: ${toMessage(error)}`);
    } finally {
      this.checking = false;
    }
  }

  /** 차례가 된 대상을 하나씩 정리하고, 실행한 대상 수를 돌려준다. */
  async runDueTargets(now: Date): Promise<number> {
    let executed = 0;
    for (const target of await this.targetRepository.findEnabled()) {
      if (
        !isDailyScheduleDue(target, now) ||
        this.runner.isRunning(target.id)
      ) {
        continue;
      }
      // 기준 시각을 먼저 옮겨, 정리 도중 서버가 내려가도 같은 예약을 되풀이하지 않는다.
      await this.targetRepository.moveScheduleCursor(target.id, now);
      try {
        await this.runner.runToCompletion(target.id, 'schedule');
        executed += 1;
      } catch (error) {
        this.logger.error(
          `[작업 폴더 정리] ${target.name}: 예약 실행을 시작하지 못함 — ${toMessage(error)}`,
        );
      }
    }
    return executed;
  }
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
