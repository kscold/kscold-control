import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions';
import { LogsService } from '../../application/services/logs.service';
import { LogType } from '../../domain/types/log.type';

@Controller('logs')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  /**
   * 로그 조회
   */
  @Get()
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
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
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  async getPm2Logs(@Query('lines') lines?: string) {
    const lineCount = lines ? parseInt(lines) : 100;
    return this.logsService.getPm2Logs(lineCount);
  }

  /**
   * Docker 컨테이너 목록
   */
  @Get('docker/containers')
  @RequirePermissions(PERMISSIONS.DOCKER_READ)
  async getDockerContainers() {
    return this.logsService.getDockerContainers();
  }

  /**
   * Nginx 상태
   */
  @Get('nginx/status')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  async getNginxStatus() {
    return this.logsService.getNginxStatus();
  }

  /**
   * 시스템 정보
   */
  @Get('system')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  async getSystemInfo() {
    return this.logsService.getSystemInfo();
  }
}
