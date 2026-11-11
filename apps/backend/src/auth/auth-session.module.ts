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
import { User } from '../rbac/domain/entities/user.entity';
import { USER_REPOSITORY } from '../rbac/domain/repositories/user.repository.interface';
import { TypeOrmUserRepository } from '../rbac/infrastructure/repositories/typeorm-user.repository';

// RbacModule 도 세션을 끊어야 하는데 AuthModule 이 RbacModule 을 가져오므로, 순환을 피해 세션 부분만 따로 둔다.
// 같은 이유로 소켓 확인에 쓰는 사용자 저장소도 RbacModule 을 거치지 않고 여기서 만든다.
@Module({
  imports: [
    TypeOrmModule.forFeature([AuthSession, User]),
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
    { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
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
