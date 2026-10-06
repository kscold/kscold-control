import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  BackupTargetAccessService,
  type BackupViewer,
} from '../../../rbac/application/services/backup-target-access.service';
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

/** 백업 실행 이력 조회 — 최근 실행부터, 조회하는 사용자가 볼 수 있는 대상의 것만 */
@Injectable()
export class ListBackupRunsUseCase {
  constructor(
    @Inject(BACKUP_RUN_REPOSITORY)
    private readonly runRepository: IBackupRunRepository,
    private readonly targetAccess: BackupTargetAccessService,
  ) {}

  async execute(
    viewer: BackupViewer,
    params: ListBackupRunsParams = {},
  ): Promise<BackupRun[]> {
    const limit = params.limit ?? DEFAULT_BACKUP_RUN_LIMIT;
    const visibleIds = await this.targetAccess.resolveVisibleTargetIds(viewer);

    if (visibleIds === null) {
      return this.runRepository.findRecent({
        targetId: params.targetId,
        limit,
      });
    }

    if (params.targetId) {
      if (!visibleIds.has(params.targetId)) {
        throw new ForbiddenException('이 백업 대상을 볼 권한이 없습니다.');
      }
      return this.runRepository.findRecent({
        targetId: params.targetId,
        limit,
      });
    }

    // 배정받은 대상이 없으면 조회할 것도 없다.
    if (visibleIds.size === 0) {
      return [];
    }
    return this.runRepository.findRecent({ targetIds: [...visibleIds], limit });
  }
}
