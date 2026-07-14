import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

// 컨트롤러
import { AuthController } from './presentation/controllers/auth.controller';

// Services (JwtStrategy 전용 토큰 검증)
import { AuthService } from './application/services/auth.service';

// 유스케이스
import {
  RegisterUseCase,
  LoginUseCase,
  GetMeUseCase,
} from './application/use-cases';

// 사용자/역할 저장소는 RbacModule이 단일 소유·export 한다 (중복 구현 제거)
import { RbacModule } from '../rbac/rbac.module';

// 전략(Passport)
import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';

@Module({
  imports: [
    RbacModule,
    PassportModule,
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

    // 유스케이스
    RegisterUseCase,
    LoginUseCase,
    GetMeUseCase,

    // 전략(Passport)
    JwtStrategy,
  ],
  // AuthService를 주입하는 외부 모듈이 없어 export 제거
  // (다른 모듈의 AuthModule import는 JwtStrategy 등록 목적)
})
export class AuthModule {}
