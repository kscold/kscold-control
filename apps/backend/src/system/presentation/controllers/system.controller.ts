import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { SystemService } from '../../application/services/system.service';
import { BackupService } from '../../application/services/backup.service';

@Controller('system')
@UseGuards(AuthGuard('jwt'))
export class SystemController {
  constructor(
    private readonly systemService: SystemService,
    private readonly backupService: BackupService,
  ) {}

  @Get('stats')
  async getStats() {
    return this.systemService.getStats();
  }

  @Get('info')
  async getSystemInfo() {
    return this.systemService.getSystemInfo();
  }

  @Post('backup/mongodb/:containerName')
  async backupMongodb(@Param('containerName') containerName: string) {
    const result = await this.backupService.backupMongodb(containerName);
    return { success: true, ...result };
  }

  @Get('backup/mongodb/:containerName/list')
  listBackups(@Param('containerName') containerName: string) {
    return this.backupService.listBackups(containerName);
  }
}
