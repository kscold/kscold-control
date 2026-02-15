import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Domain
import { Session } from './domain/entities/session.entity';
import { Message } from './domain/entities/message.entity';

// Application Services
import {
  PtyManagerService,
  SessionMapperService,
  TerminalLimitService,
} from './application/services';

// Presentation
import { TerminalGateway } from './presentation/gateways/terminal.gateway';

// RBAC (for user repository)
import { RbacModule } from '../rbac/rbac.module';

/**
 * Terminal Module
 * Clean Architecture implementation for terminal sessions
 *
 * Dependencies:
 * - Domain: Entities, Interfaces (no dependencies)
 * - Application: Services (depends on Domain)
 * - Presentation: Gateway (depends on Application)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Session, Message]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is required');
        }
        return {
          secret,
          signOptions: { expiresIn: '1d' },
        };
      },
    }),
    RbacModule, // Import to access USER_REPOSITORY
  ],
  providers: [
    // Application Services
    PtyManagerService,
    SessionMapperService,
    TerminalLimitService,

    // Presentation
    TerminalGateway,
  ],
  exports: [TerminalGateway],
})
export class TerminalModule {}
