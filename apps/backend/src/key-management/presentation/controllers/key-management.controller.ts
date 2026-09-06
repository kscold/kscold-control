import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PERMISSIONS } from '../../../common/constants/permissions';
import { Audit } from '../../../common/decorators/audit.decorator';
import { AllowDuringImpersonation } from '../../../common/decorators/allow-during-impersonation.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import type { JwtRequest } from '../../../common/types/jwt-request.type';
import {
  PatchEnvironmentKeyDto,
  RestoreSecretBackupDto,
  UpdateEnvironmentDto,
} from '../../application/dto';
import { KeyManagementService } from '../../application/services/key-management.service';
import { KeyManagementTargetAccessGuard } from '../guards/key-management-target-access.guard';
import { KeyManagementTargetAccessService } from '../../../rbac/application/services/key-management-target-access.service';

interface MutationResponse {
  backupId: string;
  previousVersion: string;
  version: string;
  changedKeys: string[];
  deployment: { requestId: string; state: string };
}

@Controller('key-management')
@UseGuards(AuthGuard('jwt'), PermissionsGuard, KeyManagementTargetAccessGuard)
export class KeyManagementController {
  constructor(
    private readonly keyManagement: KeyManagementService,
    private readonly targetAccess: KeyManagementTargetAccessService,
  ) {}

  @Get('targets')
  @RequirePermissions(PERMISSIONS.SECRETS_READ)
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  async listTargets(@Request() req: JwtRequest) {
    const targetIds = await this.targetAccess.getAuthorizedTargetIds(req.user);
    return this.keyManagement.listTargets(targetIds);
  }

  @Post('targets/:targetId/reveal')
  @RequirePermissions(PERMISSIONS.SECRETS_REVEAL)
  @AllowDuringImpersonation()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Pragma', 'no-cache')
  @Audit({
    domain: 'secrets',
    action: 'secret.reveal',
    summary: (ctx) =>
      `${ctx.params.targetId} 운영 환경 변수를 공개 조회했습니다.`,
    targetType: 'secret-target',
    targetId: (ctx) => ctx.params.targetId,
    metadata: (ctx) => ({
      version: (ctx.response as { version: string }).version,
    }),
  })
  reveal(@Param('targetId') targetId: string) {
    return this.keyManagement.reveal(targetId);
  }

  @Put('targets/:targetId/environment')
  @RequirePermissions(PERMISSIONS.SECRETS_WRITE, PERMISSIONS.SECRETS_DEPLOY)
  @Audit({
    domain: 'secrets',
    action: 'secret.update',
    summary: (ctx) => {
      const response = ctx.response as MutationResponse;
      return `${ctx.params.targetId} 환경 변수 ${response.changedKeys.length}개를 새 버전으로 배포 요청했습니다.`;
    },
    targetType: 'secret-target',
    targetId: (ctx) => ctx.params.targetId,
    metadata: (ctx) => {
      const response = ctx.response as MutationResponse;
      return {
        backupId: response.backupId,
        previousVersion: response.previousVersion,
        version: response.version,
        changedKeys: response.changedKeys,
        deploymentRequestId: response.deployment.requestId,
      };
    },
  })
  updateEnvironment(
    @Param('targetId') targetId: string,
    @Body() dto: UpdateEnvironmentDto,
    @Request() req: JwtRequest,
  ) {
    return this.keyManagement.updateEnvironment(
      targetId,
      dto.envFile,
      dto.expectedVersion,
      { id: req.user.id, email: req.user.email },
    );
  }

  @Patch('targets/:targetId/environment/:key')
  @RequirePermissions(PERMISSIONS.SECRETS_WRITE, PERMISSIONS.SECRETS_DEPLOY)
  @Audit({
    domain: 'secrets',
    action: 'secret.patch-key',
    summary: (ctx) =>
      `${ctx.params.targetId}의 ${ctx.params.key} 키를 변경하고 배포 요청했습니다.`,
    targetType: 'secret-key',
    targetId: (ctx) => `${ctx.params.targetId}:${ctx.params.key}`,
    metadata: (ctx) => {
      const response = ctx.response as MutationResponse;
      return {
        backupId: response.backupId,
        previousVersion: response.previousVersion,
        version: response.version,
        changedKeys: response.changedKeys,
        deploymentRequestId: response.deployment.requestId,
      };
    },
  })
  patchEnvironmentKey(
    @Param('targetId') targetId: string,
    @Param('key') key: string,
    @Body() dto: PatchEnvironmentKeyDto,
    @Request() req: JwtRequest,
  ) {
    return this.keyManagement.patchEnvironmentKey(
      targetId,
      key,
      dto.secretValue,
      dto.expectedVersion,
      { id: req.user.id, email: req.user.email },
    );
  }

  @Get('targets/:targetId/backups')
  @RequirePermissions(PERMISSIONS.SECRETS_READ)
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  listBackups(
    @Param('targetId') targetId: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 30;
    return this.keyManagement.listBackups(
      targetId,
      Number.isFinite(parsedLimit) ? parsedLimit : 30,
    );
  }

  @Post('targets/:targetId/backups/:backupId/restore')
  @RequirePermissions(PERMISSIONS.SECRETS_WRITE, PERMISSIONS.SECRETS_DEPLOY)
  @Audit({
    domain: 'secrets',
    action: 'secret.restore',
    summary: (ctx) =>
      `${ctx.params.targetId} 환경 변수를 백업 ${ctx.params.backupId} 기준으로 복원 요청했습니다.`,
    targetType: 'secret-backup',
    targetId: (ctx) => ctx.params.backupId,
    metadata: (ctx) => {
      const response = ctx.response as MutationResponse;
      return {
        backupId: response.backupId,
        restoredFromBackupId: ctx.params.backupId,
        previousVersion: response.previousVersion,
        version: response.version,
        changedKeys: response.changedKeys,
        deploymentRequestId: response.deployment.requestId,
      };
    },
  })
  restore(
    @Param('targetId') targetId: string,
    @Param('backupId') backupId: string,
    @Body() dto: RestoreSecretBackupDto,
    @Request() req: JwtRequest,
  ) {
    return this.keyManagement.restore(targetId, backupId, dto.expectedVersion, {
      id: req.user.id,
      email: req.user.email,
    });
  }

  @Post('targets/:targetId/backups/:backupId/retry-deployment')
  @RequirePermissions(PERMISSIONS.SECRETS_DEPLOY)
  @Audit({
    domain: 'secrets',
    action: 'secret.retry-deployment',
    summary: (ctx) =>
      `${ctx.params.targetId} 환경 변수 배포를 다시 요청했습니다.`,
    targetType: 'secret-backup',
    targetId: (ctx) => ctx.params.backupId,
    metadata: (ctx) => ({
      deploymentRequestId: (ctx.response as { requestId: string }).requestId,
      version: (ctx.response as { version: string }).version,
    }),
  })
  retryDeployment(
    @Param('targetId') targetId: string,
    @Param('backupId') backupId: string,
  ) {
    return this.keyManagement.retryDeployment(targetId, backupId);
  }
}
