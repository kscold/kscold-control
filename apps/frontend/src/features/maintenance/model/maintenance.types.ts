export type WorktreeKeepReason =
  | 'recent'
  | 'active-process'
  | 'uncommitted-changes'
  | 'unpushed-commits'
  | 'not-merged'
  | 'inspection-failed';

export interface WorktreeCleanupRun {
  id: string;
  targetId: string;
  targetName: string | null;
  trigger: 'schedule' | 'manual';
  status: 'running' | 'success' | 'failed';
  message: string;
  removed: Array<{
    name: string;
    branch: string | null;
    headSha: string;
    repositoryPath: string;
    sizeBytes: number;
    backupPath: string;
  }>;
  kept: Array<{ name: string; reasons: WorktreeKeepReason[] }>;
  freedBytes: number;
  actorEmail: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface WorktreeCleanupTarget {
  id: string;
  name: string;
  description: string;
  rootPath: string;
  keepRecent: number;
  protectUnmerged: boolean;
  baseRefs: string[];
  scheduleTime: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorktreeCleanupTargetStatus extends WorktreeCleanupTarget {
  running: boolean;
  nextRunAt: string | null;
  lastRun: WorktreeCleanupRun | null;
}

export interface WorktreeCleanupOverview {
  timeZone: string;
  items: WorktreeCleanupTargetStatus[];
}

export interface WorktreeDecision {
  name: string;
  path: string;
  branch: string | null;
  lastActivityAt: string | null;
  sizeBytes: number;
  action: 'keep' | 'remove';
  reasons: WorktreeKeepReason[];
  detail?: string;
}

export interface WorktreeCleanupPreview {
  staleRepositories: string[];
  items: WorktreeDecision[];
}

export interface WorktreeCleanupTargetInput {
  name: string;
  description?: string;
  rootPath: string;
  keepRecent?: number;
  protectUnmerged?: boolean;
  baseRefs?: string[];
  scheduleTime?: string;
  enabled?: boolean;
}

export type UpdateWorktreeCleanupTargetInput = Partial<
  Omit<WorktreeCleanupTargetInput, 'name' | 'rootPath'>
>;

export const KEEP_REASON_LABELS: Record<WorktreeKeepReason, string> = {
  recent: '최근 작업',
  'active-process': '실행 중',
  'uncommitted-changes': '커밋 안 한 변경',
  'unpushed-commits': '푸시 안 한 커밋',
  'not-merged': '미병합',
  'inspection-failed': '확인 실패',
};

export const WORKTREE_CLEANUP_DEFAULTS = {
  keepRecent: 3,
  scheduleTime: '04:30',
  baseRefs: ['origin/dev', 'origin/main', 'origin/master'],
} as const;
