import { Inject, Injectable } from '@nestjs/common';
import {
  SCHEDULED_BACKUP_CRON,
  SCHEDULED_BACKUP_TIME_ZONE,
} from '../../domain/policies/scheduled-backup.policy';
import {
  MONGODB_BACKUP_REPOSITORY,
  type IMongodbBackupRepository,
} from '../../domain/repositories/mongodb-backup.repository';
import {
  SCHEDULED_BACKUP_RUN_REPOSITORY,
  type IScheduledBackupRunRepository,
} from '../../domain/repositories/scheduled-backup-run.repository';
import type { ScheduledBackupOverview } from '../../domain/types/scheduled-backup.type';
import { ScheduledBackupService } from '../services/scheduled-backup.service';

/** 예약 백업 일정과 대상별 최근 실행 결과·보관 중인 백업 목록 조회 */
@Injectable()
export class GetScheduledBackupsUseCase {
  constructor(
    private readonly scheduledBackupService: ScheduledBackupService,
    @Inject(SCHEDULED_BACKUP_RUN_REPOSITORY)
    private readonly runRepository: IScheduledBackupRunRepository,
    @Inject(MONGODB_BACKUP_REPOSITORY)
    private readonly mongodbBackupRepository: IMongodbBackupRepository,
  ) {}

  async execute(): Promise<ScheduledBackupOverview> {
    // 접속 URI 에는 자격증명이 들어 있으므로 응답에는 이름과 보관 기간만 싣는다.
    const targets = await Promise.all(
      this.scheduledBackupService.listTargets().map(async (target) => ({
        name: target.name,
        retentionDays: target.retentionDays,
        running: this.scheduledBackupService.isRunning(target.name),
        lastRun: this.runRepository.findLatest(target.name),
        backups: await this.mongodbBackupRepository.list(target.name),
      })),
    );

    return {
      schedule: {
        cron: SCHEDULED_BACKUP_CRON,
        timeZone: SCHEDULED_BACKUP_TIME_ZONE,
      },
      targets,
    };
  }
}
