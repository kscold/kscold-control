import { Injectable } from '@nestjs/common';
import { TerminalSessionService } from '../services/terminal-session.service';
import type { Session } from '../../domain/entities/session.entity';

/** 터미널 세션 엔티티의 최근 활동 시각 갱신 후 저장 */
@Injectable()
export class TouchTerminalSessionUseCase {
  constructor(private readonly terminalSession: TerminalSessionService) {}

  execute(session: Session): Promise<void> {
    return this.terminalSession.touchSession(session);
  }
}
