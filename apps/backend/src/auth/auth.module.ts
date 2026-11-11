import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

// 컨트롤러
import { AuthController } from './presentation/controllers/auth.controller';

// Services (JwtStrategy 전용 토큰 검증)
import { AuthService } from './application/services/auth.service';
import { AuthSessionService } from './application/services/auth-session.service';
import { SessionVerifier } from './application/services/session-verifier.service';
import { AuthSession } from './domain/entities/auth-session.entity';
import { AUTH_SESSION_REPOSITORY } from './domain/repositories/auth-session.repository.interface';
import { TypeOrmAuthSessionRepository } from './infrastructure/repositories/typeorm-auth-session.repository';

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

// 전략(Passport)
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';

@Module({
  imports: [
    RbacModule,
    PassportModule,
    TypeOrmModule.forFeature([AuthSession]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is required');
        }
        return {
          secret,
          signOptions: { expiresIn: '7d' },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    // 서비스
    AuthService,
    AuthSessionService,
    SessionVerifier,
    {
      provide: AUTH_SESSION_REPOSITORY,
      useClass: TypeOrmAuthSessionRepository,
    },

    // 유스케이스
    RegisterUseCase,
    LoginUseCase,
    GetMeUseCase,
    RefreshTokenUseCase,
    StartImpersonationUseCase,

    // 전략(Passport)
    JwtStrategy,
  ],
  // WebSocket 게이트웨이도 HTTP 와 같은 세션 확인을 거치도록 내보낸다.
  exports: [SessionVerifier],
})
export class AuthModule {}
