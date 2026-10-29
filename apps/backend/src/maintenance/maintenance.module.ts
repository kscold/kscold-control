import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorktreeCleanupRunnerService } from './application/services/worktree-cleanup-runner.service';
import { WorktreeCleanupSchedulerService } from './application/services/worktree-cleanup-scheduler.service';
import {
  GetStorageOverviewUseCase,
  GetWorktreeCleanupOverviewUseCase,
  ListWorktreeCleanupRunsUseCase,
  ManageWorktreeCleanupTargetUseCase,
  PreviewWorktreeCleanupUseCase,
  RunWorktreeCleanupUseCase,
  TrimDockerDiskUseCase,
} from './application/use-cases';
import { WorktreeCleanupRun } from './domain/entities/worktree-cleanup-run.entity';
import { WorktreeCleanupTarget } from './domain/entities/worktree-cleanup-target.entity';
import { WORKTREE_CLEANUP_RUN_REPOSITORY } from './domain/repositories/worktree-cleanup-run.repository';
import { WORKTREE_CLEANUP_TARGET_REPOSITORY } from './domain/repositories/worktree-cleanup-target.repository';
import { STORAGE_INSPECTION_GATEWAY } from './domain/repositories/storage-inspection.gateway';
import { WORKTREE_WORKSPACE_GATEWAY } from './domain/repositories/worktree-workspace.gateway';
import { GitWorktreeWorkspaceGateway } from './infrastructure/gateways/git-worktree-workspace.gateway';
import { HostStorageInspectionGateway } from './infrastructure/gateways/host-storage-inspection.gateway';
import { TypeOrmWorktreeCleanupRunRepository } from './infrastructure/repositories/typeorm-worktree-cleanup-run.repository';
import { TypeOrmWorktreeCleanupTargetRepository } from './infrastructure/repositories/typeorm-worktree-cleanup-target.repository';
import { StorageController } from './presentation/controllers/storage.controller';
import { WorktreeCleanupController } from './presentation/controllers/worktree-cleanup.controller';

/**
 * 서버 유지보수 모듈
 *
 * 작업이 끝난 git 작업 폴더(worktree)를 매일 정해진 시각에 정리해 디스크를 되찾고,
 * 맥·도커 VM·도커 안 저장공간 현황을 보여준다.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([WorktreeCleanupTarget, WorktreeCleanupRun]),
  ],
  controllers: [WorktreeCleanupController, StorageController],
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
