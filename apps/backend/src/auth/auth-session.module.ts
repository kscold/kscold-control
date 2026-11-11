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
import { MfaConfig } from './mfa/application/mfa-config';

// RbacModule 도 세션을 끊어야 하는데 AuthModule 이 RbacModule 을 가져오므로, 순환을 피해 세션 부분만 따로 둔다.
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
    // 세션 확인이 2단계 인증 요구를 보므로 키 검사도 여기서 기동과 함께 한다.
    {
      provide: MfaConfig,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => MfaConfig.fromConfig(config),
    },
  ],
  exports: [
    AuthSessionService,
    SessionVerifier,
    SessionConnectionRegistry,
    MfaConfig,
  ],
})
export class AuthSessionModule {}
