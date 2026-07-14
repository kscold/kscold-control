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
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../../common/constants/permissions';
import {
  ListPortMappingsUseCase,
  AddPortMappingUseCase,
  RemovePortMappingUseCase,
  GetExternalIpUseCase,
} from '../../application/use-cases';
import { CreateMappingRequestDto } from '../dto/create-mapping.request.dto';

@Controller('upnp')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class UpnpController {
  constructor(
    private readonly listPortMappingsUseCase: ListPortMappingsUseCase,
    private readonly addPortMappingUseCase: AddPortMappingUseCase,
    private readonly removePortMappingUseCase: RemovePortMappingUseCase,
    private readonly getExternalIpUseCase: GetExternalIpUseCase,
  ) {}

  /**
   * List all UPnP port mappings on the router
   * GET /upnp/mappings
   */
  @Get('mappings')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  getMappings() {
    return this.listPortMappingsUseCase.execute();
  }

  /**
   * Add a new port mapping
   * POST /upnp/mappings
   */
  @Post('mappings')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  addMapping(@Body() dto: CreateMappingRequestDto) {
    return this.addPortMappingUseCase.execute(dto);
  }

  /**
   * Remove a port mapping
   * DELETE /upnp/mappings/:publicPort
   */
  @Delete('mappings/:publicPort')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  removeMapping(
    @Param('publicPort') publicPort: string,
    @Query('protocol') protocol?: string,
  ) {
    return this.removePortMappingUseCase.execute(
      parseInt(publicPort, 10),
      protocol,
    );
  }

  /**
   * Get external IP from router via UPnP
   * GET /upnp/external-ip
   */
  @Get('external-ip')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  async getExternalIp() {
    const ip = await this.getExternalIpUseCase.execute();
    return { ip };
  }
}
