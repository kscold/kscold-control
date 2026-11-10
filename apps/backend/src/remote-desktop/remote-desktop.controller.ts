import { Controller, Post, Req, Header, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { JwtRequest } from '../common/types/jwt-request.type';
import { RemoteDesktopService } from './remote-desktop.service';

@Controller('remote-desktop')
@UseGuards(AuthGuard('jwt'))
export class RemoteDesktopController {
  constructor(private readonly desktop: RemoteDesktopService) {}

  @Post('ticket')
  @Header('Cache-Control', 'no-store')
  create(@Req() request: JwtRequest) {
    return this.desktop.issue(request.user);
  }
}
