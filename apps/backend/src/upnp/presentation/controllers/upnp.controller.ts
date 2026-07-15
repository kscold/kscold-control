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
import { AddPortMappingDto } from '../../application/dto';
import { CreateMappingRequestDto } from '../dto';

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
   * 라우터의 UPnP 포트 매핑 전체 목록
   * GET /upnp/mappings
   */
  @Get('mappings')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  getMappings() {
    return this.listPortMappingsUseCase.execute();
  }

  /**
   * 새 포트 매핑 추가
   * POST /upnp/mappings
   */
  @Post('mappings')
  @RequirePermissions(PERMISSIONS.SYSTEM_WRITE)
  addMapping(@Body() dto: CreateMappingRequestDto) {
    return this.addPortMappingUseCase.execute(AddPortMappingDto.from(dto));
  }

  /**
   * 포트 매핑 삭제
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
   * UPnP로 라우터에서 외부 IP 조회
   * GET /upnp/external-ip
   */
  @Get('external-ip')
  @RequirePermissions(PERMISSIONS.SYSTEM_READ)
  async getExternalIp() {
    const ip = await this.getExternalIpUseCase.execute();
    return { ip };
  }
}
