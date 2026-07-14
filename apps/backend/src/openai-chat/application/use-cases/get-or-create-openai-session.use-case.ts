import { Injectable } from '@nestjs/common';
import { TerminalSessionService } from '../../../terminal/application/services/terminal-session.service';

@Injectable()
export class GetOrCreateOpenAISessionUseCase {
  constructor(private readonly terminalSession: TerminalSessionService) {}

  execute(userId: string, provider: 'api' | 'codex', requestedSessionId?: string) {
    return this.terminalSession.getOrCreateSession(
      userId,
      requestedSessionId,
      `OpenAI ${provider === 'codex' ? 'Codex' : 'Chat'}`,
    );
  }
}
