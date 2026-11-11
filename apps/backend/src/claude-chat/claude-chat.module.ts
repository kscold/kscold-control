import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { TerminalModule } from '../terminal/terminal.module';
import { RbacModule } from '../rbac/rbac.module';

import { ClaudeDiagnosticsService } from './application/services/claude-diagnostics.service';
import { ClaudeProcessManagerService } from './application/services/claude-process-manager.service';
import { ClaudeSessionMapperService } from './application/services/claude-session-mapper.service';
import {
  GetClaudeDiagnosticsUseCase,
  GetOrCreateClaudeSessionUseCase,
  GetClaudeHistoryUseCase,
  SaveClaudeMessageUseCase,
  TouchClaudeSessionUseCase,
  CloseClaudeSessionUseCase,
} from './application/use-cases';
import { ClaudeDiagnosticsController } from './presentation/controllers/claude-diagnostics.controller';
import { ClaudeChatGateway } from './presentation/gateways/claude-chat.gateway';

@Module({
  imports: [TerminalModule, AuthModule, RbacModule],
  controllers: [ClaudeDiagnosticsController],
  providers: [
    // 인프라성 서비스: 프로세스/캐시/클라이언트 매핑 실시간 로직 보유
    ClaudeDiagnosticsService,
    ClaudeProcessManagerService,
    ClaudeSessionMapperService,
    // Use-cases (세션/메시지 로직은 terminal의 SESSION_MANAGER 포트에 위임)
    GetClaudeDiagnosticsUseCase,
    GetOrCreateClaudeSessionUseCase,
    GetClaudeHistoryUseCase,
    SaveClaudeMessageUseCase,
    TouchClaudeSessionUseCase,
    CloseClaudeSessionUseCase,
    ClaudeChatGateway,
  ],
})
export class ClaudeChatModule {}
