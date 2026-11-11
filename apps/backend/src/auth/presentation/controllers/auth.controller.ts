import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Param,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request as ExpressRequest } from 'express';
import {
  RegisterUseCase,
  LoginUseCase,
  GetMeUseCase,
  RefreshTokenUseCase,
  StartImpersonationUseCase,
} from '../../application/use-cases';
import { LoginDto, RegisterDto } from '../../application/dto';
import type { User } from '../../../rbac/domain/entities/user.entity';
import type { JwtRequest } from '../../../common/types/jwt-request.type';
import { Audit } from '../../../common/decorators/audit.decorator';
import { AllowDuringImpersonation } from '../../../common/decorators/allow-during-impersonation.decorator';
import { clientIp } from '../../../common/utils/client-ip.util';
import {
  AuthSessionService,
  type SessionClient,
} from '../../application/services/auth-session.service';

function sessionClient(req: ExpressRequest): SessionClient {
  return {
    ip: clientIp(req),
    userAgent: req.headers['user-agent']?.slice(0, 512) || null,
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly getMeUseCase: GetMeUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly startImpersonationUseCase: StartImpersonationUseCase,
    private readonly authSessions: AuthSessionService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return this.registerUseCase.execute(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: ExpressRequest) {
    return this.loginUseCase.execute(dto, sessionClient(req));
  }

  /** 이 토큰의 서버 세션을 끊는다. 미리보기 토큰이면 미리보기만, 관리자 토큰이면 미리보기까지 끊긴다. */
  @UseGuards(AuthGuard('jwt'))
  @AllowDuringImpersonation()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Request() req: JwtRequest) {
    await this.authSessions.revoke(req.user.sessionId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getMe(@Request() req: { user: User }) {
    return this.getMeUseCase.execute(req.user);
  }

  /**
   * 접근 토큰 갱신
   *
   * 아직 유효한 토큰으로만 호출할 수 있고, 만료가 임박했을 때 화면이 미리 호출한다.
   * 긴 작업(대용량 소스 동기화) 중 만료로 세션이 끊기는 것을 막는다.
   */
  @UseGuards(AuthGuard('jwt'))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Request() req: { user: User & { sessionId: string } }) {
    return this.refreshTokenUseCase.execute(req.user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('impersonation/:targetUserId')
  @HttpCode(HttpStatus.OK)
  @Audit({
    domain: 'rbac',
    action: 'impersonation.start',
    summary: (ctx) =>
      `사용자 ${(ctx.response as { user: { email: string } }).user.email} 화면의 QA 미리보기를 시작했습니다.`,
    targetType: 'user',
    targetId: (ctx) => ctx.params.targetUserId,
    metadata: (ctx) => {
      const response = ctx.response as {
        sessionId: string;
        expiresAt: string;
        readOnly: boolean;
      };
      return {
        sessionId: response.sessionId,
        expiresAt: response.expiresAt,
        readOnly: response.readOnly,
      };
    },
  })
  async startImpersonation(
    @Param('targetUserId') targetUserId: string,
    @Req() req: ExpressRequest & JwtRequest,
  ) {
    return this.startImpersonationUseCase.execute(
      req.user,
      targetUserId,
      sessionClient(req),
    );
  }
}
