import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { SystemService } from '../../application/services/system.service';

@Controller('system')
@UseGuards(AuthGuard('jwt'))
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('stats')
  async getStats() {
    return this.systemService.getStats();
  }

  @Get('info')
  async getSystemInfo() {
    return this.systemService.getSystemInfo();
  }
}
