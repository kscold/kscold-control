import type { WorktreeCleanupRun } from '../entities/worktree-cleanup-run.entity';
import type {
  KeptWorktree,
  RemovedWorktree,
  WorktreeCleanupActor,
  WorktreeCleanupTrigger,
} from '../types/worktree.type';

export interface StartWorktreeCleanupRunInput {
  targetId: string;
  trigger: WorktreeCleanupTrigger;
  actor: WorktreeCleanupActor | null;
}

export interface FinishWorktreeCleanupRunInput {
  status: 'success' | 'failed';
  message: string;
  removed: RemovedWorktree[];
  kept: KeptWorktree[];
  freedBytes: number;
}

export interface IWorktreeCleanupRunRepository {
  start(input: StartWorktreeCleanupRunInput): Promise<WorktreeCleanupRun>;
  finish(
    id: string,
    input: FinishWorktreeCleanupRunInput,
  ): Promise<WorktreeCleanupRun>;
  /** 대상별 가장 최근 실행 */
  findLatestByTargetIds(
    targetIds: string[],
  ): Promise<Map<string, WorktreeCleanupRun>>;
  /** 최근 실행부터, 대상 이름을 보여줄 수 있게 대상을 함께 읽는다. */
  findRecent(options: {
    targetId?: string;
    limit: number;
  }): Promise<WorktreeCleanupRun[]>;
  /** 끝나지 못하고 실행 중으로 남은 기록을 실패로 닫고, 닫은 개수를 돌려준다. */
  failUnfinished(message: string): Promise<number>;
}

export const WORKTREE_CLEANUP_RUN_REPOSITORY = Symbol(
  'WORKTREE_CLEANUP_RUN_REPOSITORY',
);
