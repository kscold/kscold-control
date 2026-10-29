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
  /** 정리 전후 실제로 늘어난 디스크 여유 공간. 측정 못 했으면 null */
  diskReclaimedBytes: number | null;
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

/** 저장공간 현황 — 맥 디스크, 도커 VM 디스크, 도커 안 사용량, 맥의 큰 폴더 */
export interface StorageDiskUsage {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
}

export interface StorageDockerVmDisk {
  path: string;
  /** 맥에서 VM 디스크 파일이 실제로 차지하는 크기 */
  allocatedBytes: number;
  /** VM 안 도커 파일시스템이 쓰는 크기 */
  usedBytes: number | null;
  /** 공간 반환으로 맥에 돌려줄 수 있는 크기 */
  reclaimableBytes: number | null;
  /** VM이 열어 둔 채 지워진 맥 파일 — VM을 다시 시작해야 돌아온다 */
  heldDeletedBytes: number | null;
  heldDeletedFiles: number;
}

export interface StorageContainer {
  name: string;
  image: string;
  state: string;
  writableBytes: number;
  oversized: boolean;
}

export interface StorageImage {
  id: string;
  reference: string | null;
  sizeBytes: number;
  uniqueBytes: number;
}

export interface StorageVolume {
  name: string;
  sizeBytes: number;
  project: string | null;
}

export interface StorageFolder {
  key: string;
  label: string;
  description: string;
  path: string;
  sizeBytes: number | null;
}

export interface StorageOverview {
  measuredAt: string;
  host: StorageDiskUsage | null;
  dockerVm: StorageDockerVmDisk | null;
  docker: {
    containers: StorageContainer[];
    unusedImages: StorageImage[];
    unreferencedVolumes: StorageVolume[];
    buildCacheBytes: number;
  } | null;
  folders: StorageFolder[];
  warnings: string[];
}

export interface DockerDiskTrimResult {
  trimmedBytes: number | null;
  allocatedBeforeBytes: number;
  allocatedAfterBytes: number;
}

/** 자동 작업 — Control 안 예약 작업, 맥 launchd 작업, 컨테이너 안 자동 정리 */
export type AutomationKind = 'control' | 'launchd' | 'container';
export type AutomationHealth =
  'ok' | 'failed' | 'stopped' | 'running' | 'unknown';

export interface AutomationJob {
  key: string;
  kind: AutomationKind;
  name: string;
  description: string;
  schedule: string;
  health: AutomationHealth;
  lastRunAt: string | null;
  lastMessage: string | null;
}

export interface StorageTrimRun {
  id: string;
  trigger: 'schedule' | 'manual';
  status: 'running' | 'succeeded' | 'failed';
  message: string;
  allocatedBeforeBytes: number | null;
  allocatedAfterBytes: number | null;
  actorEmail: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface AutomationsOverview {
  generatedAt: string;
  jobs: AutomationJob[];
  trimRuns: StorageTrimRun[];
  warnings: string[];
}
