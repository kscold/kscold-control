import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { LogsService, LogType } from './logs.service';

@Controller('logs')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  /**
   * 로그 조회
   */
  @Get()
  @RequirePermissions('system:read')
  async getLogs(
    @Query('type') type: LogType,
    @Query('lines') lines?: string,
    @Query('containerId') containerId?: string,
  ) {
    const lineCount = lines ? parseInt(lines) : 100;
    const logs = await this.logsService.getLogs(type, lineCount, containerId);
    return { type, lines: lineCount, logs };
  }

  /**
   * PM2 로그 조회
   */
  @Get('pm2')
  @RequirePermissions('system:read')
  async getPm2Logs(@Query('lines') lines?: string) {
    const lineCount = lines ? parseInt(lines) : 100;
    return this.logsService.getPm2Logs(lineCount);
  }

  /**
   * Docker 컨테이너 목록
   */
  @Get('docker/containers')
  @RequirePermissions('docker:read')
  async getDockerContainers() {
    return this.logsService.getDockerContainers();
  }

  /**
   * Nginx 상태
   */
  @Get('nginx/status')
  @RequirePermissions('system:read')
  async getNginxStatus() {
    return this.logsService.getNginxStatus();
  }

  /**
   * 시스템 정보
   */
  @Get('system')
  @RequirePermissions('system:read')
  async getSystemInfo() {
    return this.logsService.getSystemInfo();
  }
}
