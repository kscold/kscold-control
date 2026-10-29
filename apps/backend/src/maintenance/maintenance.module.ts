import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorktreeCleanupRunnerService } from './application/services/worktree-cleanup-runner.service';
import { WorktreeCleanupSchedulerService } from './application/services/worktree-cleanup-scheduler.service';
import { StorageTrimSchedulerService } from './application/services/storage-trim-scheduler.service';
import {
  GetAutomationsUseCase,
  GetStorageOverviewUseCase,
  GetWorktreeCleanupOverviewUseCase,
  ListWorktreeCleanupRunsUseCase,
  ManageWorktreeCleanupTargetUseCase,
  PreviewWorktreeCleanupUseCase,
  RunWorktreeCleanupUseCase,
  TrimDockerDiskUseCase,
} from './application/use-cases';
import { StorageTrimRun } from './domain/entities/storage-trim-run.entity';
import { WorktreeCleanupRun } from './domain/entities/worktree-cleanup-run.entity';
import { WorktreeCleanupTarget } from './domain/entities/worktree-cleanup-target.entity';
import { WORKTREE_CLEANUP_RUN_REPOSITORY } from './domain/repositories/worktree-cleanup-run.repository';
import { WORKTREE_CLEANUP_TARGET_REPOSITORY } from './domain/repositories/worktree-cleanup-target.repository';
import { AUTOMATION_INSPECTION_GATEWAY } from './domain/repositories/automation-inspection.gateway';
import { STORAGE_INSPECTION_GATEWAY } from './domain/repositories/storage-inspection.gateway';
import { STORAGE_TRIM_RUN_REPOSITORY } from './domain/repositories/storage-trim-run.repository';
import { WORKTREE_WORKSPACE_GATEWAY } from './domain/repositories/worktree-workspace.gateway';
import { GitWorktreeWorkspaceGateway } from './infrastructure/gateways/git-worktree-workspace.gateway';
import { HostAutomationInspectionGateway } from './infrastructure/gateways/host-automation-inspection.gateway';
import { HostStorageInspectionGateway } from './infrastructure/gateways/host-storage-inspection.gateway';
import { TypeOrmStorageTrimRunRepository } from './infrastructure/repositories/typeorm-storage-trim-run.repository';
import { TypeOrmWorktreeCleanupRunRepository } from './infrastructure/repositories/typeorm-worktree-cleanup-run.repository';
import { TypeOrmWorktreeCleanupTargetRepository } from './infrastructure/repositories/typeorm-worktree-cleanup-target.repository';
import { AutomationController } from './presentation/controllers/automation.controller';
import { StorageController } from './presentation/controllers/storage.controller';
import { WorktreeCleanupController } from './presentation/controllers/worktree-cleanup.controller';

/**
 * 서버 유지보수 모듈
 *
 * 작업이 끝난 git 작업 폴더(worktree)를 매일 정해진 시각에 정리해 디스크를 되찾고,
 * 맥·도커 VM·도커 안 저장공간 현황과 자동 작업 현황을 보여주며,
 * 매일 도커 VM 의 빈 공간을 맥에 돌려준다.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorktreeCleanupTarget,
      WorktreeCleanupRun,
      StorageTrimRun,
    ]),
  ],
  controllers: [
    WorktreeCleanupController,
    StorageController,
    AutomationController,
  ],
  providers: [
    GetWorktreeCleanupOverviewUseCase,
    PreviewWorktreeCleanupUseCase,
    ManageWorktreeCleanupTargetUseCase,
    RunWorktreeCleanupUseCase,
    ListWorktreeCleanupRunsUseCase,
    WorktreeCleanupRunnerService,
    WorktreeCleanupSchedulerService,
    GetStorageOverviewUseCase,
    TrimDockerDiskUseCase,
    GetAutomationsUseCase,
    StorageTrimSchedulerService,
    {
      provide: STORAGE_TRIM_RUN_REPOSITORY,
      useClass: TypeOrmStorageTrimRunRepository,
    },
    {
      provide: AUTOMATION_INSPECTION_GATEWAY,
      useClass: HostAutomationInspectionGateway,
    },
    {
      provide: STORAGE_INSPECTION_GATEWAY,
      useClass: HostStorageInspectionGateway,
    },
    {
      provide: WORKTREE_CLEANUP_TARGET_REPOSITORY,
      useClass: TypeOrmWorktreeCleanupTargetRepository,
    },
    {
      provide: WORKTREE_CLEANUP_RUN_REPOSITORY,
      useClass: TypeOrmWorktreeCleanupRunRepository,
    },
    {
      provide: WORKTREE_WORKSPACE_GATEWAY,
      useClass: GitWorktreeWorkspaceGateway,
    },
  ],
})
export class MaintenanceModule {}
