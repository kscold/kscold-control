import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { UpnpService, CreateMappingDto } from './upnp.service';

@Controller('upnp')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class UpnpController {
  constructor(private readonly upnpService: UpnpService) {}

  /**
   * List all UPnP port mappings on the router
   * GET /upnp/mappings
   */
  @Get('mappings')
  @RequirePermissions('system:read')
  getMappings() {
    return this.upnpService.getMappings();
  }

  /**
   * Add a new port mapping
   * POST /upnp/mappings
   */
  @Post('mappings')
  @RequirePermissions('system:write')
  addMapping(@Body() dto: CreateMappingDto) {
    return this.upnpService.addMapping(dto);
  }

  /**
   * Remove a port mapping
   * DELETE /upnp/mappings/:publicPort
   */
  @Delete('mappings/:publicPort')
  @RequirePermissions('system:write')
  removeMapping(
    @Param('publicPort') publicPort: string,
    @Query('protocol') protocol?: string,
  ) {
    return this.upnpService.removeMapping(parseInt(publicPort, 10), protocol);
  }

  /**
   * Get external IP from router via UPnP
   * GET /upnp/external-ip
   */
  @Get('external-ip')
  @RequirePermissions('system:read')
  async getExternalIp() {
    const ip = await this.upnpService.getExternalIp();
    return { ip };
  }
}
