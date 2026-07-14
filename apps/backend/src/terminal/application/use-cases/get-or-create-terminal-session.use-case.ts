import { Injectable } from '@nestjs/common';
import { TerminalSessionService } from '../services/terminal-session.service';
import type { Session } from '../../domain/entities/session.entity';

/** 터미널 접속 시 기존 세션 재사용 또는 신규 세션 생성 */
@Injectable()
export class GetOrCreateTerminalSessionUseCase {
  constructor(private readonly terminalSession: TerminalSessionService) {}

  execute(
    userId: string,
    requestedSessionId?: string,
  ): Promise<{ session: Session; isReconnect: boolean }> {
    return this.terminalSession.getOrCreateSession(userId, requestedSessionId);
  }
}
