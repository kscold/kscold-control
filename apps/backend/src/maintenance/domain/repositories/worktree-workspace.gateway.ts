import type {
  RemovedWorktree,
  WorktreeInspection,
  WorktreeInspectionFailure,
} from '../types/worktree.type';

export interface WorktreeScanResult {
  inspections: WorktreeInspection[];
  failures: WorktreeInspectionFailure[];
  /** 원격 상태를 새로 받지 못한 저장소 (예전 상태로 판단했다는 표시) */
  staleRepositories: string[];
}

export interface RemoveWorktreeRequest {
  targetName: string;
  inspection: WorktreeInspection;
  baseRefs: string[];
}

/** 작업 폴더를 살펴보고, 지우기 전에 로컬 파일을 남긴 뒤 지우는 포트 */
export interface IWorktreeWorkspaceGateway {
  /** 정리 루트가 있는 디스크의 남은 공간(바이트) */
  freeBytes(rootPath: string): Promise<number>;
  /** 정리 루트가 실제로 있는 디렉터리인지 */
  rootExists(rootPath: string): Promise<boolean>;
  /** 정리 루트 바로 아래의 연결된 작업 폴더(git worktree)를 살펴본다. */
  scan(rootPath: string, baseRefs: string[]): Promise<WorktreeScanResult>;
  /**
   * 지우기 직전에 상태를 다시 확인하고, 로컬 전용 파일을 백업한 뒤 작업 폴더를 지운다.
   * 다시 확인했을 때 지우면 안 되는 상태로 바뀌었으면 지우지 않고 오류를 낸다.
   */
  remove(request: RemoveWorktreeRequest): Promise<RemovedWorktree>;
}

export const WORKTREE_WORKSPACE_GATEWAY = Symbol('WORKTREE_WORKSPACE_GATEWAY');
