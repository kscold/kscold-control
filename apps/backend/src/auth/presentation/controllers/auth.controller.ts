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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  RegisterUseCase,
  LoginUseCase,
  GetMeUseCase,
  StartImpersonationUseCase,
} from '../../application/use-cases';
import { LoginDto, RegisterDto } from '../../application/dto';
import type { User } from '../../../rbac/domain/entities/user.entity';
import type { JwtRequest } from '../../../common/types/jwt-request.type';
import { Audit } from '../../../common/decorators/audit.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly getMeUseCase: GetMeUseCase,
    private readonly startImpersonationUseCase: StartImpersonationUseCase,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return this.registerUseCase.execute(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.loginUseCase.execute(dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getMe(@Request() req: { user: User }) {
    return this.getMeUseCase.execute(req.user);
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
    @Request() req: JwtRequest,
  ) {
    return this.startImpersonationUseCase.execute(req.user, targetUserId);
  }
}
