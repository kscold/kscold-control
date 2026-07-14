import { Injectable } from '@nestjs/common';
import { TerminalSessionService } from '../services/terminal-session.service';

/** 터미널 세션 최근 활동 시각 갱신 (sessionId 기준) */
@Injectable()
export class UpdateTerminalActivityUseCase {
  constructor(private readonly terminalSession: TerminalSessionService) {}

  execute(sessionId: string, userId: string): Promise<void> {
    return this.terminalSession.updateActivity(sessionId, userId);
  }
}
