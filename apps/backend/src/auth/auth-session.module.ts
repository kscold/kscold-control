import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthSessionService } from './application/services/auth-session.service';
import { SessionConnectionRegistry } from './application/services/session-connection-registry.service';
import { SessionVerifier } from './application/services/session-verifier.service';
import { AuthSession } from './domain/entities/auth-session.entity';
import { AUTH_SESSION_REPOSITORY } from './domain/repositories/auth-session.repository.interface';
import { TypeOrmAuthSessionRepository } from './infrastructure/repositories/typeorm-auth-session.repository';

/**
 * 서버 세션의 발급·확인·끊기와 세션에 묶인 연결.
 * 사용자 관리(RbacModule)도 비밀번호를 바꿀 때 세션을 끊어야 하는데 AuthModule 은 RbacModule 을 가져오므로,
 * 세션 부분만 따로 두어 두 모듈이 순환 없이 함께 쓴다.
 */
@Module({
  imports: [
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
  providers: [
    AuthSessionService,
    SessionVerifier,
    SessionConnectionRegistry,
    {
      provide: AUTH_SESSION_REPOSITORY,
      useClass: TypeOrmAuthSessionRepository,
    },
  ],
  exports: [AuthSessionService, SessionVerifier, SessionConnectionRegistry],
})
export class AuthSessionModule {}
