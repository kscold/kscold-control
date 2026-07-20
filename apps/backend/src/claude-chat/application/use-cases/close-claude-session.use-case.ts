import { Inject, Injectable } from '@nestjs/common';
import { SESSION_MANAGER } from '../../../terminal/domain/ports/session-manager.port';
import type { ISessionManager } from '../../../terminal/domain/ports/session-manager.port';

/** Claude 챗 세션 닫기 (비활성화) */
@Injectable()
export class CloseClaudeSessionUseCase {
  constructor(
    @Inject(SESSION_MANAGER)
    private readonly sessionManager: ISessionManager,
  ) {}

  execute(sessionId: string, userId: string) {
    return this.sessionManager.closeSession(sessionId, userId);
  }
}
