import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

// Controllers
import { AuthController } from './presentation/controllers/auth.controller';

// Services
import { AuthService } from './application/services/auth.service';

// 사용자/역할 저장소는 RbacModule이 단일 소유·export 한다 (중복 구현 제거)
import { RbacModule } from '../rbac/rbac.module';

// Strategies
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
    // Services
    AuthService,

    // Strategies
    JwtStrategy,
  ],
  exports: [AuthService], // 다른 모듈에서 사용할 수 있도록 export
})
export class AuthModule {}
