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
  CreateBackupTargetDto,
  ListBackupRunsDto,
  UpdateBackupTargetDto,
} from '../../application/dto';
import {
  CreateBackupTargetUseCase,
  DeleteBackupTargetUseCase,
  GetBackupOverviewUseCase,
  ListBackupRunsUseCase,
  RunBackupTargetUseCase,
  UpdateBackupTargetUseCase,
  type BackupTargetStatus,
} from '../../application/use-cases';
import type { BackupRun } from '../../domain/entities/backup-run.entity';
import type { BackupTarget } from '../../domain/entities/backup-target.entity';

/** req._auditExtra 로 인터셉터에 넘기는 감사용 추가 데이터 */
type BackupAuditExtra = {
  changedFields?: string[];
};

type BackupRequest = JwtRequest & {
  _auditExtra?: BackupAuditExtra;
};

/** 응답 본문에서 감사 로그가 읽는 값 */
type TargetResponse = ReturnType<typeof toTargetResponse>;
type RunResponse = ReturnType<typeof toRunResponse>;

/**
 * 백업 관리 컨트롤러
 * 표현 계층 — HTTP 관심사만 처리한다.
 * 감사 로깅은 @Audit() + AuditInterceptor(AOP)가 맡는다.
 *
 * 접속 URI 는 어떤 응답에도 싣지 않는다. 자격증명을 뺀 접속 위치만 내보낸다.
 */
@Controller('backups')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class BackupController {
  constructor(
    private readonly getBackupOverview: GetBackupOverviewUseCase,
    private readonly createBackupTarget: CreateBackupTargetUseCase,
    private readonly updateBackupTarget: UpdateBackupTargetUseCase,
    private readonly deleteBackupTarget: DeleteBackupTargetUseCase,
    private readonly runBackupTarget: RunBackupTargetUseCase,
    private readonly listBackupRuns: ListBackupRunsUseCase,
  ) {}

  @Get('targets')
  @RequirePermissions(PERMISSIONS.BACKUP_READ)
  async listTargets() {
    const overview = await this.getBackupOverview.execute();
    return {
      timeZone: overview.timeZone,
      items: overview.items.map(toTargetStatusResponse),
    };
  }

  @Post('targets')
  @RequirePermissions(PERMISSIONS.BACKUP_MANAGE)
  @Audit({
    domain: 'backup',
    action: 'target.create',
    summary: (ctx) =>
      `백업 대상 ${(ctx.response as TargetResponse).name}을(를) 등록했습니다.`,
    targetType: 'backup-target',
    targetId: (ctx) => (ctx.response as TargetResponse).name,
    metadata: (ctx) => {
      const target = ctx.response as TargetResponse;
      return {
        targetId: target.id,
        connectionSummary: target.connectionSummary,
        scheduleTime: target.scheduleTime,
        retentionDays: target.retentionDays,
        enabled: target.enabled,
      };
    },
  })
  async createTarget(
    @Body() dto: CreateBackupTargetDto,
    @Req() req: BackupRequest,
  ) {
    const target = await this.createBackupTarget.execute({
      ...dto,
      createdBy: req.user?.id ?? null,
    });
    return toTargetResponse(target);
  }

  @Patch('targets/:id')
  @RequirePermissions(PERMISSIONS.BACKUP_MANAGE)
  @Audit({
    domain: 'backup',
    action: 'target.update',
    summary: (ctx) =>
      `백업 대상 ${(ctx.response as TargetResponse).name}의 설정을 변경했습니다.`,
    targetType: 'backup-target',
    targetId: (ctx) => (ctx.response as TargetResponse).name,
    // 접속 URI 는 값 대신 "바뀌었다"는 사실만 남긴다.
    metadata: (ctx) => {
      const target = ctx.response as TargetResponse;
      return {
        targetId: target.id,
        changedFields: (ctx.extra as BackupAuditExtra).changedFields ?? [],
        scheduleTime: target.scheduleTime,
        retentionDays: target.retentionDays,
        enabled: target.enabled,
      };
    },
  })
  async updateTarget(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateBackupTargetDto,
    @Req() req: BackupRequest,
  ) {
    const { target, changedFields } = await this.updateBackupTarget.execute(
      id,
      dto,
    );
    req._auditExtra = { changedFields };
    return toTargetResponse(target);
  }

  @Delete('targets/:id')
  @RequirePermissions(PERMISSIONS.BACKUP_MANAGE)
  @Audit({
    domain: 'backup',
    action: 'target.delete',
    summary: (ctx) =>
      `백업 대상 ${(ctx.response as TargetResponse).name}을(를) 삭제했습니다. 백업 파일은 남아 있습니다.`,
    targetType: 'backup-target',
    targetId: (ctx) => (ctx.response as TargetResponse).name,
    metadata: (ctx) => {
      const target = ctx.response as TargetResponse;
      return {
        targetId: target.id,
        connectionSummary: target.connectionSummary,
      };
    },
  })
  async removeTarget(@Param('id', new ParseUUIDPipe()) id: string) {
    const target = await this.deleteBackupTarget.execute(id);
    return toTargetResponse(target);
  }

  /** 덤프는 뒤에서 이어지므로 시작한 실행 기록만 돌려준다 (202). */
  @Post('targets/:id/run')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions(PERMISSIONS.BACKUP_MANAGE)
  @Audit({
    domain: 'backup',
    action: 'target.run',
    summary: '백업을 수동으로 실행했습니다.',
    targetType: 'backup-target',
    targetId: (ctx) => ctx.params.id,
    metadata: (ctx) => ({ runId: (ctx.response as RunResponse).id }),
  })
  async runTarget(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: BackupRequest,
  ) {
    const run = await this.runBackupTarget.execute(id, {
      id: req.user?.id ?? null,
      email: req.user?.email ?? null,
    });
    return toRunResponse(run);
  }

  @Get('runs')
  @RequirePermissions(PERMISSIONS.BACKUP_READ)
  async listRuns(@Query() query: ListBackupRunsDto) {
    const runs = await this.listBackupRuns.execute(query);
    return { items: runs.map(toRunResponse) };
  }
}

function toTargetResponse(target: BackupTarget) {
  return {
    id: target.id,
    name: target.name,
    description: target.description,
    engine: target.engine,
    connectionSummary: target.connectionSummary,
    dumpImage: target.dumpImage,
    retentionDays: target.retentionDays,
    scheduleTime: target.scheduleTime,
    enabled: target.enabled,
    createdAt: target.createdAt.toISOString(),
    updatedAt: target.updatedAt.toISOString(),
  };
}

function toRunResponse(run: BackupRun) {
  return {
    id: run.id,
    targetId: run.targetId,
    targetName: run.target?.name ?? null,
    trigger: run.trigger,
    status: run.status,
    message: run.message,
    archivePath: run.archivePath,
    archiveSizeBytes: run.archiveSizeBytes,
    pruned: run.pruned,
    actorEmail: run.actorEmail,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
  };
}

function toTargetStatusResponse(status: BackupTargetStatus) {
  return {
    ...toTargetResponse(status.target),
    running: status.running,
    nextRunAt: status.nextRunAt ? status.nextRunAt.toISOString() : null,
    lastRun: status.lastRun ? toRunResponse(status.lastRun) : null,
    archives: status.archives.map((archive) => ({
      name: archive.name,
      takenAt: archive.takenAt.toISOString(),
      path: archive.path,
      sizeBytes: archive.sizeBytes,
    })),
  };
}
