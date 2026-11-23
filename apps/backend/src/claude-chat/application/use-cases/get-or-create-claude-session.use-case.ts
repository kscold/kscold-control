import { Inject, Injectable } from '@nestjs/common';
import { SESSION_MANAGER } from '../../../terminal/domain/gateways/session-manager.gateway.interface';
import type { ISessionManager } from '../../../terminal/domain/gateways/session-manager.gateway.interface';

/** Claude 챗 접속 시 기존 세션 재사용 또는 신규 세션 생성 */
@Injectable()
export class GetOrCreateClaudeSessionUseCase {
  constructor(
    @Inject(SESSION_MANAGER)
    private readonly sessionManager: ISessionManager,
  ) {}

  execute(userId: string, requestedSessionId?: string) {
    return this.sessionManager.getOrCreateSession(
      userId,
      requestedSessionId,
      'Claude Chat',
    );
  }
}
