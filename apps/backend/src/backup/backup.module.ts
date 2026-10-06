import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecretEncryptionModule } from '../common/crypto/secret-encryption.module';
import { BackupRunnerService } from './application/services/backup-runner.service';
import { BackupSchedulerService } from './application/services/backup-scheduler.service';
import { BackupTargetSecretService } from './application/services/backup-target-secret.service';
import {
  CreateBackupTargetUseCase,
  DeleteBackupTargetUseCase,
  GetBackupOverviewUseCase,
  ListBackupRunsUseCase,
  RunBackupTargetUseCase,
  UpdateBackupTargetUseCase,
} from './application/use-cases';
import { BackupRun } from './domain/entities/backup-run.entity';
import { BackupTarget } from './domain/entities/backup-target.entity';
import { BACKUP_ARCHIVE_REPOSITORY } from './domain/repositories/backup-archive.repository';
import { BACKUP_RUN_REPOSITORY } from './domain/repositories/backup-run.repository';
import { BACKUP_TARGET_REPOSITORY } from './domain/repositories/backup-target.repository';
import { DockerMongodbArchiveRepository } from './infrastructure/repositories/docker-mongodb-archive.repository';
import { TypeOrmBackupRunRepository } from './infrastructure/repositories/typeorm-backup-run.repository';
import { TypeOrmBackupTargetRepository } from './infrastructure/repositories/typeorm-backup-target.repository';
import { BackupController } from './presentation/controllers/backup.controller';

/**
 * 백업 관리 모듈
 *
 * 외부 데이터베이스의 백업 대상을 데이터베이스에서 관리하고,
 * 대상별 일정에 맞춰 덤프한 뒤 보관 기간이 지난 백업을 정리한다.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([BackupTarget, BackupRun]),
    SecretEncryptionModule,
  ],
  controllers: [BackupController],
  providers: [
    GetBackupOverviewUseCase,
    CreateBackupTargetUseCase,
    UpdateBackupTargetUseCase,
    DeleteBackupTargetUseCase,
    RunBackupTargetUseCase,
    ListBackupRunsUseCase,
    BackupTargetSecretService,
    // 실행 순서와 실행 중 표시를 가진 서비스. use-case 와 스케줄러가 함께 쓴다.
    BackupRunnerService,
    // @Cron 으로 1분마다 차례가 된 대상을 찾는다.
    BackupSchedulerService,
    {
      provide: BACKUP_TARGET_REPOSITORY,
      useClass: TypeOrmBackupTargetRepository,
    },
    { provide: BACKUP_RUN_REPOSITORY, useClass: TypeOrmBackupRunRepository },
    {
      provide: BACKUP_ARCHIVE_REPOSITORY,
      useClass: DockerMongodbArchiveRepository,
    },
  ],
})
export class BackupModule {}
