import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { TerminalModule } from '../terminal/terminal.module';
import { RbacModule } from '../rbac/rbac.module';

import { ClaudeDiagnosticsService } from './application/services/claude-diagnostics.service';
import { ClaudeProcessManagerService } from './application/services/claude-process-manager.service';
import { ClaudeSessionMapperService } from './application/services/claude-session-mapper.service';
import { ClaudeDiagnosticsController } from './presentation/controllers/claude-diagnostics.controller';
import { ClaudeChatGateway } from './presentation/gateways/claude-chat.gateway';

@Module({
  imports: [
    TerminalModule,
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
  controllers: [ClaudeDiagnosticsController],
  providers: [
    ClaudeDiagnosticsService,
    ClaudeProcessManagerService,
    ClaudeSessionMapperService,
    ClaudeChatGateway,
  ],
  exports: [ClaudeChatGateway, ClaudeDiagnosticsService],
})
export class ClaudeChatModule {}
