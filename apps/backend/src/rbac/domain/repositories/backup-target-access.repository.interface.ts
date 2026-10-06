/** 열람 범위를 정할 때 보여주는 백업 대상 */
export interface BackupTargetScope {
  id: string;
  name: string;
  description: string;
}

export interface BackupTargetAssignment {
  userId: string;
  targetIds: string[];
}

/** 사용자별 백업 대상 열람 범위를 보관하는 포트 */
export interface IBackupTargetAccessRepository {
  findTargets(): Promise<BackupTargetScope[]>;
  findTargetIdsByUserId(userId: string): Promise<string[]>;
  findAllAssignments(): Promise<BackupTargetAssignment[]>;
  /** 한 사용자의 열람 범위를 통째로 바꾼다. */
  replaceForUser(
    userId: string,
    targetIds: string[],
    grantedById: string,
  ): Promise<void>;
}

export const BACKUP_TARGET_ACCESS_REPOSITORY = Symbol(
  'BACKUP_TARGET_ACCESS_REPOSITORY',
);
