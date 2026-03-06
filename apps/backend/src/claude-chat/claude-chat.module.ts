import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { Session } from '../terminal/domain/entities/session.entity';
import { Message } from '../terminal/domain/entities/message.entity';
import { SESSION_REPOSITORY } from '../terminal/domain/interfaces/session.repository.interface';
import { MESSAGE_REPOSITORY } from '../terminal/domain/interfaces/message.repository.interface';
import { TypeOrmSessionRepository } from '../terminal/infrastructure/repositories/typeorm-session.repository';
import { TypeOrmMessageRepository } from '../terminal/infrastructure/repositories/typeorm-message.repository';
import { RbacModule } from '../rbac/rbac.module';

import { ClaudeProcessManagerService } from './application/services/claude-process-manager.service';
import { ClaudeSessionMapperService } from './application/services/claude-session-mapper.service';
import { ClaudeChatGateway } from './presentation/gateways/claude-chat.gateway';

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
    RbacModule,
  ],
  providers: [
    { provide: SESSION_REPOSITORY, useClass: TypeOrmSessionRepository },
    { provide: MESSAGE_REPOSITORY, useClass: TypeOrmMessageRepository },
    ClaudeProcessManagerService,
    ClaudeSessionMapperService,
    ClaudeChatGateway,
  ],
  exports: [ClaudeChatGateway],
})
export class ClaudeChatModule {}
