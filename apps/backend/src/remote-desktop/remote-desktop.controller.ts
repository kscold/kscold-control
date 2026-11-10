import {
  Controller,
  Post,
  Req,
  Header,
  UseGuards,
  Get,
  Put,
  Delete,
  Param,
  Body,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { JwtRequest } from '../common/types/jwt-request.type';
import {
  RemoteDesktopService,
  canControlDesktop,
} from './remote-desktop.service';
import { RemoteDesktopTargetsService } from './remote-desktop-targets.service';
import { SaveDesktopTargetDto } from './presentation/dto/save-desktop-target.dto';

@Controller('remote-desktop')
@UseGuards(AuthGuard('jwt'))
export class RemoteDesktopController {
  constructor(
    private readonly desktop: RemoteDesktopService,
    private readonly targets: RemoteDesktopTargetsService,
  ) {}

  private authorize(request: JwtRequest) {
    if (!canControlDesktop(request.user))
      throw new ForbiddenException('관리자 본인 계정만 사용할 수 있습니다.');
  }

  @Get('targets')
  @Header('Cache-Control', 'no-store')
  list(@Req() request: JwtRequest) {
    this.authorize(request);
    return this.targets.list();
  }

  @Post('targets')
  createTarget(
    @Req() request: JwtRequest,
    @Body() input: SaveDesktopTargetDto,
  ) {
    this.authorize(request);
    return this.targets.save(undefined, input);
  }

  @Put('targets/:id')
  updateTarget(
    @Req() request: JwtRequest,
    @Param('id') id: string,
    @Body() input: SaveDesktopTargetDto,
  ) {
    this.authorize(request);
    return this.targets.save(id, input);
  }

  @Delete('targets/:id')
  removeTarget(@Req() request: JwtRequest, @Param('id') id: string) {
    this.authorize(request);
    return this.targets.remove(id);
  }

  @Post('targets/:id/ticket')
  @Header('Cache-Control', 'no-store')
  async targetTicket(@Req() request: JwtRequest, @Param('id') id: string) {
    this.authorize(request);
    return this.desktop.issue(request.user, await this.targets.connection(id));
  }

  @Post('ticket')
  @Header('Cache-Control', 'no-store')
  create(@Req() request: JwtRequest) {
    return this.desktop.issue(request.user);
  }
}
