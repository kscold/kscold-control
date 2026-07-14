import { Injectable } from '@nestjs/common';
import { TerminalSessionService } from '../services/terminal-session.service';
import type { Session } from '../../domain/entities/session.entity';

/** 터미널 세션과 메시지 함께 조회 */
@Injectable()
export class LoadTerminalSessionUseCase {
  constructor(private readonly terminalSession: TerminalSessionService) {}

  execute(sessionId: string, userId: string): Promise<Session | null> {
    return this.terminalSession.loadSessionWithMessages(sessionId, userId);
  }
}
