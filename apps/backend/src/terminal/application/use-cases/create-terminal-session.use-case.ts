import { Injectable } from '@nestjs/common';
import { TerminalSessionService } from '../services/terminal-session.service';
import type { Session } from '../../domain/entities/session.entity';

/** 이름을 지정한 새 터미널 세션 생성 */
@Injectable()
export class CreateTerminalSessionUseCase {
  constructor(private readonly terminalSession: TerminalSessionService) {}

  execute(userId: string, title: string): Promise<Session> {
    return this.terminalSession.createNamedSession(userId, title);
  }
}
