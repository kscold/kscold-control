import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { TerminalModule } from '../terminal/terminal.module';
import { RbacModule } from '../rbac/rbac.module';

import { OpenAIApiService } from './application/services/openai-api.service';
import { CodexProcessManagerService } from './application/services/codex-process-manager.service';
import { OpenAISessionMapperService } from './application/services/openai-session-mapper.service';
import {
  GetOrCreateOpenAISessionUseCase,
  GetOpenAIHistoryUseCase,
  SaveOpenAIMessageUseCase,
  TouchOpenAISessionUseCase,
  CloseOpenAISessionUseCase,
} from './application/use-cases';
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
    // 인프라성 서비스: API 스트리밍/프로세스/클라이언트 매핑 실시간 로직 보유
    OpenAIApiService,
    CodexProcessManagerService,
    OpenAISessionMapperService,
    // Use-cases (세션/메시지 로직은 terminal의 TerminalSessionService에 위임)
    GetOrCreateOpenAISessionUseCase,
    GetOpenAIHistoryUseCase,
    SaveOpenAIMessageUseCase,
    TouchOpenAISessionUseCase,
    CloseOpenAISessionUseCase,
    OpenAIChatGateway,
  ],
})
export class OpenAIChatModule {}
