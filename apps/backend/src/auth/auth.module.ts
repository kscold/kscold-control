import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

// 컨트롤러
import { AuthController } from './presentation/controllers/auth.controller';

// Services (JwtStrategy 전용 토큰 검증)
import { AuthService } from './application/services/auth.service';
import { AuthSessionModule } from './auth-session.module';
import { MfaModule } from './mfa/mfa.module';

// 유스케이스
import {
  RegisterUseCase,
  LoginUseCase,
  GetMeUseCase,
  RefreshTokenUseCase,
  StartImpersonationUseCase,
} from './application/use-cases';

// 사용자/역할 저장소는 RbacModule이 단일 소유·export 한다 (중복 구현 제거)
import { RbacModule } from '../rbac/rbac.module';
import { SecurityModule } from '../security/security.module';

// 전략(Passport)
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';

@Module({
  imports: [
    RbacModule,
    PassportModule,
    AuthSessionModule,
    SecurityModule,
    MfaModule,
  ],
  controllers: [AuthController],
  providers: [
    // 서비스
    AuthService,

    // 유스케이스
    RegisterUseCase,
    LoginUseCase,
    GetMeUseCase,
    RefreshTokenUseCase,
    StartImpersonationUseCase,

    // 전략(Passport)
    JwtStrategy,
  ],
  exports: [AuthSessionModule],
})
export class AuthModule {}
