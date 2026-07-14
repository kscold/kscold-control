import { Injectable } from '@nestjs/common';
import { TerminalSessionService } from '../services/terminal-session.service';

/** 터미널 세션 메시지 저장 */
@Injectable()
export class SaveTerminalMessageUseCase {
  constructor(private readonly terminalSession: TerminalSessionService) {}

  execute(
    sessionId: string,
    userId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
  ): Promise<void> {
    return this.terminalSession.saveMessage(sessionId, userId, role, content);
  }
}
