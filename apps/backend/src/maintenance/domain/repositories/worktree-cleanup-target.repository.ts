import type { WorktreeCleanupTarget } from '../entities/worktree-cleanup-target.entity';

export interface CreateWorktreeCleanupTargetInput {
  name: string;
  description: string;
  rootPath: string;
  keepRecent: number;
  protectUnmerged: boolean;
  baseRefs: string[];
  scheduleTime: string;
  enabled: boolean;
  scheduleCursorAt: Date;
  createdBy: string | null;
}

/** 대상 수정 값. 넘기지 않은 항목은 그대로 둔다. 이름·루트는 바꾸지 않는다. */
export type UpdateWorktreeCleanupTargetInput = Partial<
  Omit<CreateWorktreeCleanupTargetInput, 'name' | 'rootPath' | 'createdBy'>
>;

export interface IWorktreeCleanupTargetRepository {
  findAll(): Promise<WorktreeCleanupTarget[]>;
  findEnabled(): Promise<WorktreeCleanupTarget[]>;
  findById(id: string): Promise<WorktreeCleanupTarget | null>;
  findByNameOrRoot(
    name: string,
    rootPath: string,
  ): Promise<WorktreeCleanupTarget | null>;
  create(
    input: CreateWorktreeCleanupTargetInput,
  ): Promise<WorktreeCleanupTarget>;
  update(
    id: string,
    input: UpdateWorktreeCleanupTargetInput,
  ): Promise<WorktreeCleanupTarget | null>;
  /** 예약 실행 기준 시각만 옮긴다. 수정 시각은 건드리지 않는다. */
  moveScheduleCursor(id: string, at: Date): Promise<void>;
  remove(id: string): Promise<void>;
}

export const WORKTREE_CLEANUP_TARGET_REPOSITORY = Symbol(
  'WORKTREE_CLEANUP_TARGET_REPOSITORY',
);
