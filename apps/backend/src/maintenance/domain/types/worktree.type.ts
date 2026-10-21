/** 실행 계기 — 예약 시각 도래 또는 화면에서 직접 실행 */
export type WorktreeCleanupTrigger = 'schedule' | 'manual';

export type WorktreeCleanupRunStatus = 'running' | 'success' | 'failed';

/** 작업 폴더 하나를 살펴본 결과 */
export interface WorktreeInspection {
  /** 정리 루트 바로 아래의 폴더 이름 */
  name: string;
  path: string;
  /** 이 작업 폴더가 딸린 원본 저장소 경로 */
  repositoryPath: string;
  /** 체크아웃된 브랜치. 분리된 HEAD 면 null */
  branch: string | null;
  headSha: string;
  /** 마지막 커밋 시각과 마지막 Git 작업(인덱스 변경) 시각 중 늦은 쪽 */
  lastActivityAt: Date;
  /** 커밋하지 않은 변경 개수 (무시되지 않은 새 파일 포함) */
  uncommittedCount: number;
  /** 원격 어디에도 없는 커밋 개수 */
  unpushedCount: number;
  /** 기준 브랜치(dev·main 등) 중 하나에 이미 들어갔는지 */
  merged: boolean;
  /** 이 폴더 안에서 실행 중인 프로세스가 있는지 */
  active: boolean;
  sizeBytes: number;
}

/** 살펴보다 실패한 폴더. 지우지 않고 이유만 남긴다. */
export interface WorktreeInspectionFailure {
  name: string;
  path: string;
  message: string;
}

/** 지우지 않는 이유 */
export type WorktreeKeepReason =
  | 'recent'
  | 'active-process'
  | 'uncommitted-changes'
  | 'unpushed-commits'
  | 'not-merged'
  | 'inspection-failed';

export interface WorktreeDecision {
  name: string;
  path: string;
  branch: string | null;
  lastActivityAt: Date | null;
  sizeBytes: number;
  action: 'keep' | 'remove';
  /** 지우지 않는 이유들 (action 이 keep 일 때만) */
  reasons: WorktreeKeepReason[];
  /** 살펴보다 실패한 경우의 설명 */
  detail?: string;
}

/** 지운 작업 폴더의 기록 */
export interface RemovedWorktree {
  name: string;
  branch: string | null;
  headSha: string;
  repositoryPath: string;
  sizeBytes: number;
  /** 지우기 전 남긴 로컬 전용 파일(.env 등)과 복원 안내가 든 위치 */
  backupPath: string;
}

/** 지우지 않고 남긴 작업 폴더의 기록 */
export interface KeptWorktree {
  name: string;
  reasons: WorktreeKeepReason[];
}

/** 수동 실행을 요청한 사용자 */
export interface WorktreeCleanupActor {
  id: string | null;
  email: string | null;
}
