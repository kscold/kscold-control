import { Module } from '@nestjs/common';

import {
  BackupMongodbUseCase,
  GetStatsUseCase,
  GetRemoteAccessUseCase,
  GetSystemInfoUseCase,
  ListBackupsUseCase,
} from './application/use-cases';
import { OS_METRICS_REPOSITORY } from './domain/repositories/os-metrics.repository.interface';
import { MONGODB_BACKUP_REPOSITORY } from './domain/repositories/mongodb-backup.repository.interface';
import { REMOTE_ACCESS_REPOSITORY } from './domain/repositories/remote-access.repository.interface';
import { ShellRemoteAccessRepository } from './infrastructure/repositories/shell-remote-access.repository';
import { ShellOsMetricsRepository } from './infrastructure/repositories/shell-os-metrics.repository';
import { DockerMongodbBackupRepository } from './infrastructure/repositories/docker-mongodb-backup.repository';
import { SystemController } from './presentation/controllers/system.controller';

@Module({
  controllers: [SystemController],
  providers: [
    GetStatsUseCase,
    GetSystemInfoUseCase,
    BackupMongodbUseCase,
    ListBackupsUseCase,
    GetRemoteAccessUseCase,
    {
      provide: REMOTE_ACCESS_REPOSITORY,
      useClass: ShellRemoteAccessRepository,
    },
    { provide: OS_METRICS_REPOSITORY, useClass: ShellOsMetricsRepository },
    {
      provide: MONGODB_BACKUP_REPOSITORY,
      useClass: DockerMongodbBackupRepository,
    },
  ],
})
export class SystemModule {}
