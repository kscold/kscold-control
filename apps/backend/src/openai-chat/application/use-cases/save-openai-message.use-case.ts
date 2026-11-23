import { Inject, Injectable } from '@nestjs/common';
import { SESSION_MANAGER } from '../../../terminal/domain/gateways/session-manager.gateway.interface';
import type { ISessionManager } from '../../../terminal/domain/gateways/session-manager.gateway.interface';

/** OpenAI 챗 세션에 메시지 저장 */
@Injectable()
export class SaveOpenAIMessageUseCase {
  constructor(
    @Inject(SESSION_MANAGER)
    private readonly sessionManager: ISessionManager,
  ) {}

  execute(
    sessionId: string,
    userId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, any>,
  ) {
    return this.sessionManager.saveMessage(
      sessionId,
      userId,
      role,
      content,
      metadata,
    );
  }
}
