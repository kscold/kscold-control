import { Injectable } from '@nestjs/common';
import { TerminalSessionService } from '../../../terminal/application/services/terminal-session.service';

@Injectable()
export class SaveOpenAIMessageUseCase {
  constructor(private readonly terminalSession: TerminalSessionService) {}

  execute(
    sessionId: string,
    userId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, any>,
  ) {
    return this.terminalSession.saveMessage(
      sessionId,
      userId,
      role,
      content,
      metadata,
    );
  }
}
