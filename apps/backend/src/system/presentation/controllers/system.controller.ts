import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../../common/guards';
import { RequirePermissions } from '../../../common/decorators';
import { PERMISSIONS } from '../../../common/constants/permissions';

import { SystemService } from '../../application/services/system.service';
import { BackupService } from '../../application/services/backup.service';

@Controller('system')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class SystemController {
  constructor(
    private readonly systemService: SystemService,
    private readonly backupService: BackupService,
  ) {}

  @Get('stats')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  async getStats() {
    return this.systemService.getStats();
  }

  @Get('info')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  async getSystemInfo() {
    return this.systemService.getSystemInfo();
  }

  @Post('backup/mongodb/:containerName')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  async backupMongodb(@Param('containerName') containerName: string) {
    const result = await this.backupService.backupMongodb(containerName);
    return { success: true, ...result };
  }

  @Get('backup/mongodb/:containerName/list')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  listBackups(@Param('containerName') containerName: string) {
    return this.backupService.listBackups(containerName);
  }
}
