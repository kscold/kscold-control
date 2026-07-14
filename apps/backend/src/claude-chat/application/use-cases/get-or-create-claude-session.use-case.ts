import { Injectable } from '@nestjs/common';
import { TerminalSessionService } from '../../../terminal/application/services/terminal-session.service';

@Injectable()
export class GetOrCreateClaudeSessionUseCase {
  constructor(private readonly terminalSession: TerminalSessionService) {}

  execute(userId: string, requestedSessionId?: string) {
    return this.terminalSession.getOrCreateSession(
      userId,
      requestedSessionId,
      'Claude Chat',
    );
  }
}
