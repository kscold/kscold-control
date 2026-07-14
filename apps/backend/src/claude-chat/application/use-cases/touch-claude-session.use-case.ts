import { Injectable } from '@nestjs/common';
import { TerminalSessionService } from '../../../terminal/application/services/terminal-session.service';

@Injectable()
export class TouchClaudeSessionUseCase {
  constructor(private readonly terminalSession: TerminalSessionService) {}

  execute(sessionId: string, userId: string) {
    return this.terminalSession.updateActivity(sessionId, userId);
  }
}
