import { Inject, Injectable, Logger } from '@nestjs/common';
import type { BackupRun } from '../../domain/entities/backup-run.entity';
import type { BackupTarget } from '../../domain/entities/backup-target.entity';
import {
  BACKUP_SCHEDULE_TIME_ZONE,
  resolveNextRunAt,
} from '../../domain/policies/backup-schedule.policy';
import {
  BACKUP_ARCHIVE_REPOSITORY,
  type IBackupArchiveRepository,
} from '../../domain/repositories/backup-archive.repository';
import {
  BACKUP_RUN_REPOSITORY,
  type IBackupRunRepository,
} from '../../domain/repositories/backup-run.repository';
import {
  BACKUP_TARGET_REPOSITORY,
  type IBackupTargetRepository,
} from '../../domain/repositories/backup-target.repository';
import type { BackupArchive } from '../../domain/types/backup.type';
import { BackupRunnerService } from '../services/backup-runner.service';

/** 백업 대상 하나의 현재 상태 */
export interface BackupTargetStatus {
  target: BackupTarget;
  running: boolean;
  /** 다음 예약 실행 시각. 사용하지 않는 대상은 null */
  nextRunAt: Date | null;
  lastRun: BackupRun | null;
  archives: BackupArchive[];
}

export interface BackupOverview {
  /** 실행 시각(HH:mm)을 해석하는 시간대 */
  timeZone: string;
  items: BackupTargetStatus[];
}

/** 백업 대상 전체와 대상별 일정·최근 실행 결과·보관 중인 백업 조회 */
@Injectable()
export class GetBackupOverviewUseCase {
  private readonly logger = new Logger(GetBackupOverviewUseCase.name);

  constructor(
    @Inject(BACKUP_TARGET_REPOSITORY)
    private readonly targetRepository: IBackupTargetRepository,
    @Inject(BACKUP_RUN_REPOSITORY)
    private readonly runRepository: IBackupRunRepository,
    @Inject(BACKUP_ARCHIVE_REPOSITORY)
    private readonly archiveRepository: IBackupArchiveRepository,
    private readonly runner: BackupRunnerService,
  ) {}

  async execute(now: Date = new Date()): Promise<BackupOverview> {
    const targets = await this.targetRepository.findAll();
    const latestRuns = await this.runRepository.findLatestByTargetIds(
      targets.map((target) => target.id),
    );

    const items = await Promise.all(
      targets.map(async (target) => ({
        target,
        running: this.runner.isRunning(target.id),
        nextRunAt: resolveNextRunAt(target, now),
        lastRun: latestRuns.get(target.id) ?? null,
        archives: await this.listArchives(target),
      })),
    );

    return { timeZone: BACKUP_SCHEDULE_TIME_ZONE, items };
  }

  private async listArchives(target: BackupTarget): Promise<BackupArchive[]> {
    try {
      return await this.archiveRepository.list(target.name);
    } catch (error) {
      // 디스크를 읽지 못한 대상 하나 때문에 화면 전체가 비면 안 된다.
      this.logger.warn(
        `[백업] ${target.name}: 보관 중인 백업 조회 실패 — ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }
  }
}
