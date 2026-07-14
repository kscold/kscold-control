import { Injectable } from '@nestjs/common';
import { TerminalSessionService } from '../services/terminal-session.service';
import type { Message } from '../../domain/entities/message.entity';

/** 터미널 세션 메시지 히스토리 조회 */
@Injectable()
export class GetTerminalHistoryUseCase {
  constructor(private readonly terminalSession: TerminalSessionService) {}

  execute(sessionId: string, userId: string): Promise<Message[]> {
    return this.terminalSession.getHistory(sessionId, userId);
  }
}
