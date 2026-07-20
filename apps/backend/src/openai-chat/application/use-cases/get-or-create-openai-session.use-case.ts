import { Inject, Injectable } from '@nestjs/common';
import { SESSION_MANAGER } from '../../../terminal/domain/ports/session-manager.port';
import type { ISessionManager } from '../../../terminal/domain/ports/session-manager.port';

/** OpenAI 챗 접속 시 기존 세션 재사용 또는 신규 세션 생성 */
@Injectable()
export class GetOrCreateOpenAISessionUseCase {
  constructor(
    @Inject(SESSION_MANAGER)
    private readonly sessionManager: ISessionManager,
  ) {}

  execute(
    userId: string,
    provider: 'api' | 'codex',
    requestedSessionId?: string,
  ) {
    return this.sessionManager.getOrCreateSession(
      userId,
      requestedSessionId,
      `OpenAI ${provider === 'codex' ? 'Codex' : 'Chat'}`,
    );
  }
}
