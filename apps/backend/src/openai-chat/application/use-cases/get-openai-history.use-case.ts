import { Inject, Injectable } from '@nestjs/common';
import { SESSION_MANAGER } from '../../../terminal/domain/ports/session-manager.port';
import type { ISessionManager } from '../../../terminal/domain/ports/session-manager.port';

/** OpenAI 챗 세션의 메시지 히스토리 조회 */
@Injectable()
export class GetOpenAIHistoryUseCase {
  constructor(
    @Inject(SESSION_MANAGER)
    private readonly sessionManager: ISessionManager,
  ) {}

  execute(sessionId: string, userId: string) {
    return this.sessionManager.getHistory(sessionId, userId);
  }
}
