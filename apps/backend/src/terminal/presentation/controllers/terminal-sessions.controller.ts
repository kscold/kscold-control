import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RequirePermissions } from '../../../common/decorators';
import { PermissionsGuard } from '../../../common/guards';
import { PERMISSIONS } from '../../../common/constants/permissions';
import type { JwtRequest } from '../../../common/types/jwt-request.type';
import { ListLiveTerminalSessionsUseCase } from '../../application/use-cases/list-live-terminal-sessions.use-case';

@Controller('terminal')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class TerminalSessionsController {
  constructor(private readonly listLive: ListLiveTerminalSessionsUseCase) {}

  @Get('sessions')
  @RequirePermissions(PERMISSIONS.TERMINAL_ACCESS)
  list(@Request() req: JwtRequest) {
    return this.listLive.execute(req.user.id);
  }
}
