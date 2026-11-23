import { Inject, Injectable } from '@nestjs/common';
import { SESSION_MANAGER } from '../../../terminal/domain/gateways/session-manager.gateway.interface';
import type { ISessionManager } from '../../../terminal/domain/gateways/session-manager.gateway.interface';

/** OpenAI 챗 세션의 최근 활동 시각 갱신 */
@Injectable()
export class TouchOpenAISessionUseCase {
  constructor(
    @Inject(SESSION_MANAGER)
    private readonly sessionManager: ISessionManager,
  ) {}

  execute(sessionId: string, userId: string) {
    return this.sessionManager.updateActivity(sessionId, userId);
  }
}
