import { Module } from '@nestjs/common';

import { ScheduledBackupService } from './application/services/scheduled-backup.service';
import {
  BackupMongodbUseCase,
  GetScheduledBackupsUseCase,
  GetStatsUseCase,
  GetSystemInfoUseCase,
  ListBackupsUseCase,
  RunScheduledBackupUseCase,
} from './application/use-cases';
import { EXTERNAL_MONGODB_BACKUP_REPOSITORY } from './domain/repositories/external-mongodb-backup.repository';
import { OS_METRICS_REPOSITORY } from './domain/repositories/os-metrics.repository';
import { MONGODB_BACKUP_REPOSITORY } from './domain/repositories/mongodb-backup.repository';
import { SCHEDULED_BACKUP_RUN_REPOSITORY } from './domain/repositories/scheduled-backup-run.repository';
import { SCHEDULED_BACKUP_TARGET_REPOSITORY } from './domain/repositories/scheduled-backup-target.repository';
import { OsMetricsRepositoryImpl } from './infrastructure/repositories/os-metrics.repository.impl';
import { DockerExternalMongodbBackupRepository } from './infrastructure/repositories/docker-external-mongodb-backup.repository';
import { DockerMongodbBackupRepository } from './infrastructure/repositories/docker-mongodb-backup.repository';
import { EnvScheduledBackupTargetRepository } from './infrastructure/repositories/env-scheduled-backup-target.repository';
import { FileScheduledBackupRunRepository } from './infrastructure/repositories/file-scheduled-backup-run.repository';
import { SystemController } from './presentation/controllers/system.controller';

@Module({
  controllers: [SystemController],
  providers: [
    GetStatsUseCase,
    GetSystemInfoUseCase,
    BackupMongodbUseCase,
    ListBackupsUseCase,
    GetScheduledBackupsUseCase,
    RunScheduledBackupUseCase,
    // 예약 백업의 @Cron 스케줄러와 실행 순서를 가진 서비스. use-case 가 주입받아 위임한다.
    ScheduledBackupService,
    { provide: OS_METRICS_REPOSITORY, useClass: OsMetricsRepositoryImpl },
    {
      provide: MONGODB_BACKUP_REPOSITORY,
      useClass: DockerMongodbBackupRepository,
    },
    {
      provide: EXTERNAL_MONGODB_BACKUP_REPOSITORY,
      useClass: DockerExternalMongodbBackupRepository,
    },
    {
      provide: SCHEDULED_BACKUP_TARGET_REPOSITORY,
      useClass: EnvScheduledBackupTargetRepository,
    },
    {
      provide: SCHEDULED_BACKUP_RUN_REPOSITORY,
      useClass: FileScheduledBackupRunRepository,
    },
  ],
})
export class SystemModule {}
