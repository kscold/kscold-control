import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions';
import { ClaudeDiagnosticsService } from '../../application/services/claude-diagnostics.service';

@Controller('claude-chat')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class ClaudeDiagnosticsController {
  constructor(private readonly diagnosticsService: ClaudeDiagnosticsService) {}

  @Get('diagnostics')
  @RequirePermissions(PERMISSIONS.TERMINAL_ACCESS)
  async getDiagnostics(@Query('refresh') refresh?: string) {
    const forceRefresh = refresh === '1' || refresh === 'true';
    return this.diagnosticsService.getDiagnostics(forceRefresh);
  }
}
