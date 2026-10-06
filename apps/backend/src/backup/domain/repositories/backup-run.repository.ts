import type { BackupRun } from '../entities/backup-run.entity';
import type { BackupActor, BackupTrigger } from '../types/backup.type';

export interface StartBackupRunInput {
  targetId: string;
  trigger: BackupTrigger;
  actor: BackupActor | null;
}

export interface FinishBackupRunInput {
  status: 'success' | 'failed';
  message: string;
  archivePath: string | null;
  archiveSizeBytes: number | null;
  pruned: string[];
}

export interface FindBackupRunsOptions {
  targetId?: string;
  limit: number;
}

/** 백업 실행 이력을 보관하는 포트 */
export interface IBackupRunRepository {
  /** 실행 중 상태의 기록을 만든다. */
  start(input: StartBackupRunInput): Promise<BackupRun>;
  /** 실행 결과를 기록에 채운다. */
  finish(id: string, input: FinishBackupRunInput): Promise<BackupRun>;
  /** 대상별 가장 최근 실행. 실행한 적 없는 대상은 결과에 없다. */
  findLatestByTargetIds(targetIds: string[]): Promise<Map<string, BackupRun>>;
  /** 최근 실행부터 차례로. 대상 이름을 보여줄 수 있게 대상을 함께 읽는다. */
  findRecent(options: FindBackupRunsOptions): Promise<BackupRun[]>;
  /** 끝나지 못하고 실행 중으로 남은 기록을 실패로 닫고, 닫은 개수를 돌려준다. */
  failUnfinished(message: string): Promise<number>;
}

export const BACKUP_RUN_REPOSITORY = Symbol('BACKUP_RUN_REPOSITORY');
