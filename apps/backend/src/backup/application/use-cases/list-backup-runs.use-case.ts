import { Inject, Injectable } from '@nestjs/common';
import type { BackupRun } from '../../domain/entities/backup-run.entity';
import {
  BACKUP_RUN_REPOSITORY,
  type IBackupRunRepository,
} from '../../domain/repositories/backup-run.repository';

/** 조회 건수를 지정하지 않았을 때의 기본값 */
export const DEFAULT_BACKUP_RUN_LIMIT = 30;

export interface ListBackupRunsParams {
  targetId?: string;
  limit?: number;
}

/** 백업 실행 이력 조회 — 최근 실행부터 */
@Injectable()
export class ListBackupRunsUseCase {
  constructor(
    @Inject(BACKUP_RUN_REPOSITORY)
    private readonly runRepository: IBackupRunRepository,
  ) {}

  execute(params: ListBackupRunsParams = {}): Promise<BackupRun[]> {
    return this.runRepository.findRecent({
      targetId: params.targetId,
      limit: params.limit ?? DEFAULT_BACKUP_RUN_LIMIT,
    });
  }
}
