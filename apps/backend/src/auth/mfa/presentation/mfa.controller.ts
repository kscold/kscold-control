import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import type { JwtRequest } from '../../../common/types/jwt-request.type';
import { sessionClient } from '../../presentation/session-client';
import {
  CompleteMfaEnrollmentDto,
  MfaCodeDto,
  VerifyMfaDto,
} from '../application/dto/mfa.dto';
import { MfaService } from '../application/mfa.service';

function roleNames(roles: JwtRequest['user']['roles']): string[] {
  return roles.map((role) => (typeof role === 'string' ? role : role.name));
}

/**
 * `verify` 와 `enrollment/complete` 는 접근 토큰 없이 로그인이 준 challenge 로만 부른다.
 * 나머지는 로그인한 본인의 설정이다.
 */
@Controller('auth/mfa')
export class MfaController {
  constructor(private readonly mfa: MfaService) {}

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verify(@Body() dto: VerifyMfaDto, @Req() req: Request) {
    return this.mfa.verify(dto, sessionClient(req));
  }

  @Post('enrollment/complete')
  @HttpCode(HttpStatus.OK)
  completeEnrollment(
    @Body() dto: CompleteMfaEnrollmentDto,
    @Req() req: Request,
  ) {
    return this.mfa.completeEnrollment(dto, sessionClient(req));
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  status(@Req() req: JwtRequest) {
    return this.mfa.status({
      id: req.user.id,
      roles: roleNames(req.user.roles),
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('enrollment')
  @HttpCode(HttpStatus.OK)
  startEnrollment(@Req() req: JwtRequest) {
    return this.mfa.startEnrollment(req.user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('recovery-codes')
  @HttpCode(HttpStatus.OK)
  regenerateRecoveryCodes(
    @Body() dto: MfaCodeDto,
    @Req() req: Request & JwtRequest,
  ) {
    return this.mfa.regenerateRecoveryCodes(
      req.user,
      dto.code,
      sessionClient(req),
    );
  }
}
