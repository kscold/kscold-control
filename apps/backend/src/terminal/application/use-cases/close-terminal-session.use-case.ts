import { Injectable } from '@nestjs/common';
import { TerminalSessionService } from '../services/terminal-session.service';

/** 터미널 세션 닫기 (비활성화) */
@Injectable()
export class CloseTerminalSessionUseCase {
  constructor(private readonly terminalSession: TerminalSessionService) {}

  execute(sessionId: string, userId: string): Promise<void> {
    return this.terminalSession.closeSession(sessionId, userId);
  }
}
