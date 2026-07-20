import { Inject, Injectable } from '@nestjs/common';
import { SESSION_MANAGER } from '../../../terminal/domain/ports/session-manager.port';
import type { ISessionManager } from '../../../terminal/domain/ports/session-manager.port';

/** Claude 챗 세션의 최근 활동 시각 갱신 */
@Injectable()
export class TouchClaudeSessionUseCase {
  constructor(
    @Inject(SESSION_MANAGER)
    private readonly sessionManager: ISessionManager,
  ) {}

  execute(sessionId: string, userId: string) {
    return this.sessionManager.updateActivity(sessionId, userId);
  }
}
