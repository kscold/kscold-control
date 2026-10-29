import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PERMISSIONS } from '../../../common/constants/permissions';
import { RequirePermissions } from '../../../common/decorators';
import { PermissionsGuard } from '../../../common/guards';
import { GetAutomationsUseCase } from '../../application/use-cases';

/**
 * 자동 작업 현황 컨트롤러
 * Control 안 예약 작업, 맥 자동 실행 작업, 컨테이너 안 자동 정리를 조회만 한다.
 */
@Controller('maintenance/automations')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class AutomationController {
  constructor(private readonly getAutomations: GetAutomationsUseCase) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  async list() {
    const overview = await this.getAutomations.execute();
    return {
      generatedAt: overview.generatedAt.toISOString(),
      jobs: overview.jobs.map((job) => ({
        ...job,
        lastRunAt: job.lastRunAt?.toISOString() ?? null,
      })),
      trimRuns: overview.trimRuns.map((run) => ({
        id: run.id,
        trigger: run.trigger,
        status: run.status,
        message: run.message,
        allocatedBeforeBytes: run.allocatedBeforeBytes,
        allocatedAfterBytes: run.allocatedAfterBytes,
        actorEmail: run.actorEmail,
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString() ?? null,
      })),
      warnings: overview.warnings,
    };
  }
}
