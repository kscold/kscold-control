import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions';
import { GetClaudeDiagnosticsUseCase } from '../../application/use-cases';

@Controller('claude-chat')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class ClaudeDiagnosticsController {
  constructor(
    private readonly getDiagnosticsUseCase: GetClaudeDiagnosticsUseCase,
  ) {}

  @Get('diagnostics')
  @RequirePermissions(PERMISSIONS.TERMINAL_ACCESS)
  async getDiagnostics(@Query('refresh') refresh?: string) {
    const forceRefresh = refresh === '1' || refresh === 'true';
    return this.getDiagnosticsUseCase.execute(forceRefresh);
  }
}
