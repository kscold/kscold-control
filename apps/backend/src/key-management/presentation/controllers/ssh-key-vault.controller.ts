import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PERMISSIONS } from '../../../common/constants/permissions';
import { Audit } from '../../../common/decorators/audit.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import type { JwtRequest } from '../../../common/types/jwt-request.type';
import { isGlobalAdministrator } from '../../../common/utils/role-access.util';
import { CreateSshKeyDto } from '../../application/dto';
import {
  SshKeyVaultService,
  type SshKeySummary,
} from '../../application/services/ssh-key-vault.service';

/**
 * 서버 접속용 SSH 키 보관함.
 * 키는 특정 대상에 묶이지 않아 대상별 권한으로 나눌 수 없으므로 전역 관리자만 쓴다.
 */
@Controller('key-management/ssh-keys')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class SshKeyVaultController {
  constructor(private readonly vault: SshKeyVaultService) {}

  private assertGlobalAdministrator(req: JwtRequest): void {
    if (!isGlobalAdministrator(req.user.roles)) {
      throw new ForbiddenException('SSH 키는 전체 관리자만 다룰 수 있습니다.');
    }
  }

  @Get()
  @RequirePermissions(PERMISSIONS.SECRETS_READ)
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  list(@Request() req: JwtRequest) {
    this.assertGlobalAdministrator(req);
    return this.vault.list();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SECRETS_WRITE)
  @Audit({
    domain: 'secrets',
    action: 'ssh-key.create',
    summary: (ctx) =>
      `SSH 키 ${(ctx.response as SshKeySummary).name}을(를) 등록했습니다.`,
    targetType: 'ssh-key',
    targetId: (ctx) => (ctx.response as SshKeySummary).name,
    metadata: (ctx) => ({
      fingerprint: (ctx.response as SshKeySummary).fingerprint,
    }),
  })
  create(@Body() dto: CreateSshKeyDto, @Request() req: JwtRequest) {
    this.assertGlobalAdministrator(req);
    return this.vault.create({ ...dto, createdBy: req.user.email ?? null });
  }

  @Post(':id/download')
  @HttpCode(200)
  @RequirePermissions(PERMISSIONS.SECRETS_REVEAL)
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  @Header('Pragma', 'no-cache')
  @Audit({
    domain: 'secrets',
    action: 'ssh-key.download',
    summary: (ctx) =>
      `SSH 키 ${(ctx.response as { name: string }).name}을(를) 내려받았습니다.`,
    targetType: 'ssh-key',
    targetId: (ctx) => (ctx.response as { name: string }).name,
  })
  download(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Request() req: JwtRequest,
  ) {
    this.assertGlobalAdministrator(req);
    return this.vault.download(id);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions(PERMISSIONS.SECRETS_WRITE)
  @Audit({
    domain: 'secrets',
    action: 'ssh-key.delete',
    summary: (ctx) => `SSH 키 ${ctx.params.id}을(를) 삭제했습니다.`,
    targetType: 'ssh-key',
    targetId: (ctx) => ctx.params.id,
  })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Request() req: JwtRequest,
  ): Promise<void> {
    this.assertGlobalAdministrator(req);
    await this.vault.remove(id);
  }
}
