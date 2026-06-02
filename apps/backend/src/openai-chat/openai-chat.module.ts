import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { TerminalModule } from '../terminal/terminal.module';
import { RbacModule } from '../rbac/rbac.module';

import { OpenAIApiService } from './application/services/openai-api.service';
import { CodexProcessManagerService } from './application/services/codex-process-manager.service';
import { OpenAISessionMapperService } from './application/services/openai-session-mapper.service';
import { OpenAIChatGateway } from './presentation/gateways/openai-chat.gateway';

@Module({
  imports: [
    TerminalModule,
    RbacModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) throw new Error('JWT_SECRET is required');
        return { secret, signOptions: { expiresIn: '7d' } };
      },
    }),
  ],
  providers: [
    OpenAIApiService,
    CodexProcessManagerService,
    OpenAISessionMapperService,
    OpenAIChatGateway,
  ],
})
export class OpenAIChatModule {}
