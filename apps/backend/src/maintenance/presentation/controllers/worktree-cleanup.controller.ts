import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PERMISSIONS } from '../../../common/constants/permissions';
import { Audit, RequirePermissions } from '../../../common/decorators';
import { PermissionsGuard } from '../../../common/guards';
import type { JwtRequest } from '../../../common/types/jwt-request.type';
import {
  CreateWorktreeCleanupTargetDto,
  ListWorktreeCleanupRunsDto,
  UpdateWorktreeCleanupTargetDto,
} from '../../application/dto';
import {
  GetWorktreeCleanupOverviewUseCase,
  ListWorktreeCleanupRunsUseCase,
  ManageWorktreeCleanupTargetUseCase,
  PreviewWorktreeCleanupUseCase,
  RunWorktreeCleanupUseCase,
  type WorktreeCleanupTargetStatus,
} from '../../application/use-cases';
import type { WorktreeCleanupRun } from '../../domain/entities/worktree-cleanup-run.entity';
import type { WorktreeCleanupTarget } from '../../domain/entities/worktree-cleanup-target.entity';

type CleanupRequest = JwtRequest & {
  _auditExtra?: { changedFields?: string[] };
};

type TargetResponse = ReturnType<typeof toTargetResponse>;
type RunResponse = ReturnType<typeof toRunResponse>;

/**
 * 작업 폴더 정리 컨트롤러
 * 조회·미리보기는 시스템 조회 권한, 대상 변경과 실행은 시스템 변경 권한이 필요하다.
 */
@Controller('maintenance/worktree-cleanup')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class WorktreeCleanupController {
  constructor(
    private readonly getOverview: GetWorktreeCleanupOverviewUseCase,
    private readonly previewCleanup: PreviewWorktreeCleanupUseCase,
    private readonly manageTarget: ManageWorktreeCleanupTargetUseCase,
    private readonly runCleanup: RunWorktreeCleanupUseCase,
    private readonly listRuns: ListWorktreeCleanupRunsUseCase,
  ) {}

  @Get('targets')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  async listTargets() {
    const overview = await this.getOverview.execute();
    return {
      timeZone: overview.timeZone,
      items: overview.items.map(toTargetStatusResponse),
    };
  }

  /** 지금 정리하면 남길 것과 지울 것. 아무것도 지우지 않는다. */
  @Get('targets/:id/preview')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  async preview(@Param('id', new ParseUUIDPipe()) id: string) {
    const plan = await this.previewCleanup.execute(id);
    return {
      staleRepositories: plan.staleRepositories,
      items: plan.decisions.map((decision) => ({
        ...decision,
        lastActivityAt: decision.lastActivityAt?.toISOString() ?? null,
      })),
    };
  }

  @Post('targets')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  @Audit({
    domain: 'maintenance',
    action: 'worktree-cleanup.target.create',
    summary: (ctx) =>
      `작업 폴더 정리 대상 ${(ctx.response as TargetResponse).name}을(를) 등록했습니다.`,
    targetType: 'worktree-cleanup-target',
    targetId: (ctx) => (ctx.response as TargetResponse).name,
    metadata: (ctx) => {
      const target = ctx.response as TargetResponse;
      return {
        rootPath: target.rootPath,
        keepRecent: target.keepRecent,
        protectUnmerged: target.protectUnmerged,
        scheduleTime: target.scheduleTime,
      };
    },
  })
  async createTarget(
    @Body() dto: CreateWorktreeCleanupTargetDto,
    @Req() req: CleanupRequest,
  ) {
    const target = await this.manageTarget.create({
      ...dto,
      createdBy: req.user?.id ?? null,
    });
    return toTargetResponse(target);
  }

  @Patch('targets/:id')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  @Audit({
    domain: 'maintenance',
    action: 'worktree-cleanup.target.update',
    summary: (ctx) =>
      `작업 폴더 정리 대상 ${(ctx.response as TargetResponse).name}의 설정을 변경했습니다.`,
    targetType: 'worktree-cleanup-target',
    targetId: (ctx) => (ctx.response as TargetResponse).name,
    metadata: (ctx) => ({
      changedFields: ctx.extra.changedFields ?? [],
      keepRecent: (ctx.response as TargetResponse).keepRecent,
      enabled: (ctx.response as TargetResponse).enabled,
    }),
  })
  async updateTarget(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateWorktreeCleanupTargetDto,
    @Req() req: CleanupRequest,
  ) {
    const { target, changedFields } = await this.manageTarget.update(id, dto);
    req._auditExtra = { changedFields };
    return toTargetResponse(target);
  }

  @Delete('targets/:id')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  @Audit({
    domain: 'maintenance',
    action: 'worktree-cleanup.target.delete',
    summary: (ctx) =>
      `작업 폴더 정리 대상 ${(ctx.response as TargetResponse).name}을(를) 삭제했습니다.`,
    targetType: 'worktree-cleanup-target',
    targetId: (ctx) => (ctx.response as TargetResponse).name,
  })
  async removeTarget(@Param('id', new ParseUUIDPipe()) id: string) {
    return toTargetResponse(await this.manageTarget.remove(id));
  }

  @Post('targets/:id/run')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  @Audit({
    domain: 'maintenance',
    action: 'worktree-cleanup.run',
    summary: '작업 폴더 정리를 수동으로 실행했습니다.',
    targetType: 'worktree-cleanup-target',
    targetId: (ctx) => ctx.params.id,
    metadata: (ctx) => ({ runId: (ctx.response as RunResponse).id }),
  })
  async run(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: CleanupRequest,
  ) {
    const run = await this.runCleanup.execute(id, {
      id: req.user?.id ?? null,
      email: req.user?.email ?? null,
    });
    return toRunResponse(run);
  }

  @Get('runs')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  async runs(@Query() query: ListWorktreeCleanupRunsDto) {
    return { items: (await this.listRuns.execute(query)).map(toRunResponse) };
  }
}

function toTargetResponse(target: WorktreeCleanupTarget) {
  return {
    id: target.id,
    name: target.name,
    description: target.description,
    rootPath: target.rootPath,
    keepRecent: target.keepRecent,
    protectUnmerged: target.protectUnmerged,
    baseRefs: target.baseRefs,
    scheduleTime: target.scheduleTime,
    enabled: target.enabled,
    createdAt: target.createdAt.toISOString(),
    updatedAt: target.updatedAt.toISOString(),
  };
}

function toRunResponse(run: WorktreeCleanupRun) {
  return {
    id: run.id,
    targetId: run.targetId,
    targetName: run.target?.name ?? null,
    trigger: run.trigger,
    status: run.status,
    message: run.message,
    removed: run.removed,
    kept: run.kept,
    freedBytes: run.freedBytes,
    diskReclaimedBytes: run.diskReclaimedBytes,
    actorEmail: run.actorEmail,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
  };
}

function toTargetStatusResponse(status: WorktreeCleanupTargetStatus) {
  return {
    ...toTargetResponse(status.target),
    running: status.running,
    nextRunAt: status.nextRunAt ? status.nextRunAt.toISOString() : null,
    lastRun: status.lastRun ? toRunResponse(status.lastRun) : null,
  };
}
