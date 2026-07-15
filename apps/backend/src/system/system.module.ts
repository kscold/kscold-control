import { Module } from '@nestjs/common';

import {
  BackupMongodbUseCase,
  GetStatsUseCase,
  GetSystemInfoUseCase,
  ListBackupsUseCase,
} from './application/use-cases';
import { OS_METRICS_REPOSITORY } from './domain/repositories/os-metrics.repository';
import { MONGODB_BACKUP_REPOSITORY } from './domain/repositories/mongodb-backup.repository';
import { OsMetricsRepositoryImpl } from './infrastructure/repositories/os-metrics.repository.impl';
import { DockerMongodbBackupRepository } from './infrastructure/repositories/docker-mongodb-backup.repository';
import { SystemController } from './presentation/controllers/system.controller';

@Module({
  controllers: [SystemController],
  providers: [
    GetStatsUseCase,
    GetSystemInfoUseCase,
    BackupMongodbUseCase,
    ListBackupsUseCase,
    { provide: OS_METRICS_REPOSITORY, useClass: OsMetricsRepositoryImpl },
    {
      provide: MONGODB_BACKUP_REPOSITORY,
      useClass: DockerMongodbBackupRepository,
    },
  ],
})
export class SystemModule {}
