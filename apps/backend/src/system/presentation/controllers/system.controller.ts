import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../../common/guards';
import { RequirePermissions } from '../../../common/decorators';
import { PERMISSIONS } from '../../../common/constants/permissions';

import {
  BackupMongodbUseCase,
  GetStatsUseCase,
  GetSystemInfoUseCase,
  ListBackupsUseCase,
} from '../../application/use-cases';

@Controller('system')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class SystemController {
  constructor(
    private readonly getStatsUseCase: GetStatsUseCase,
    private readonly getSystemInfoUseCase: GetSystemInfoUseCase,
    private readonly backupMongodbUseCase: BackupMongodbUseCase,
    private readonly listBackupsUseCase: ListBackupsUseCase,
  ) {}

  @Get('dashboard/stats')
  @RequirePermissions(PERMISSIONS.DASHBOARD_READ)
  async getDashboardStats() {
    return this.getStatsUseCase.execute();
  }

  @Get('dashboard/info')
  @RequirePermissions(PERMISSIONS.DASHBOARD_READ)
  async getDashboardInfo() {
    return this.getSystemInfoUseCase.execute();
  }

  @Get('stats')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  async getStats() {
    return this.getStatsUseCase.execute();
  }

  @Get('info')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  async getSystemInfo() {
    return this.getSystemInfoUseCase.execute();
  }

  @Post('backup/mongodb/:containerName')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  async backupMongodb(@Param('containerName') containerName: string) {
    const result = await this.backupMongodbUseCase.execute(containerName);
    return { success: true, ...result };
  }

  @Get('backup/mongodb/:containerName/list')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  async listBackups(@Param('containerName') containerName: string) {
    return this.listBackupsUseCase.execute(containerName);
  }
}
