import { Injectable } from '@nestjs/common';
import { TerminalSessionService } from '../services/terminal-session.service';
import type { Session } from '../../domain/entities/session.entity';

/** 터미널 세션과 메시지 전체 삭제 (소유자 검증 포함) */
@Injectable()
export class DeleteTerminalSessionUseCase {
  constructor(private readonly terminalSession: TerminalSessionService) {}

  execute(sessionId: string, userId: string): Promise<Session | null> {
    return this.terminalSession.deleteSession(sessionId, userId);
  }
}
