import { Injectable } from '@nestjs/common';
import { TerminalSessionService } from '../services/terminal-session.service';

/** 터미널 세션 메시지 히스토리 삭제 */
@Injectable()
export class ClearTerminalHistoryUseCase {
  constructor(private readonly terminalSession: TerminalSessionService) {}

  execute(sessionId: string, userId: string): Promise<void> {
    return this.terminalSession.clearHistory(sessionId, userId);
  }
}
