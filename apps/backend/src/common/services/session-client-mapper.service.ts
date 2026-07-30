import { Logger } from '@nestjs/common';

/**
 * WebSocket 클라이언트 ↔ 세션 매핑 공통 기반 클래스.
 *
 * terminal / claude-chat / openai-chat 세 모듈이 같은 Map 두 개와 같은 조회·해제
 * 로직을 각각 복사해 갖고 있어 한곳으로 모았다.
 *
 * 상태(Map)는 인스턴스 필드이므로, 각 모듈이 자기 하위 클래스를 프로바이더로
 * 등록하는 한 세션 맵이 모듈 간에 섞이지 않는다. 하위 클래스는 생성자를 두지
 * 않아도 되므로 기존 DI 방식(의존성 없는 @Injectable 서비스)이 그대로 유지된다.
 */
export abstract class SessionClientMapper {
  /** sessionId -> Set<clientId> (한 세션에 여러 클라이언트 접속 지원) */
  private readonly sessionClients = new Map<string, Set<string>>();

  /** clientId -> sessionId (역방향 빠른 조회) */
  private readonly clientSessions = new Map<string, string>();

  /**
   * 하위 클래스가 로거를 지정하면 매핑 변화가 기록된다.
   * 지정하지 않으면(기본값) 아무것도 남기지 않는다.
   */
  protected readonly logger: Logger | null = null;

  /** 클라이언트를 세션에 연결한다. */
  mapClientToSession(clientId: string, sessionId: string): void {
    this.clientSessions.set(clientId, sessionId);

    if (!this.sessionClients.has(sessionId)) {
      this.sessionClients.set(sessionId, new Set());
    }
    this.sessionClients.get(sessionId)!.add(clientId);

    this.logger?.log(
      `[SessionMapper] Mapped client ${clientId} to session ${sessionId}`,
    );
  }

  /** 클라이언트를 세션에서 분리한다. 마지막 클라이언트면 세션 항목도 지운다. */
  unmapClient(clientId: string): void {
    const sessionId = this.clientSessions.get(clientId);
    if (!sessionId) {
      return;
    }

    const clients = this.sessionClients.get(sessionId);
    if (clients) {
      clients.delete(clientId);
      this.logger?.log(
        `[SessionMapper] Unmapped client ${clientId} from session ${sessionId}. Remaining: ${clients.size}`,
      );

      if (clients.size === 0) {
        this.sessionClients.delete(sessionId);
        this.logger?.log(
          `[SessionMapper] No clients remaining for session ${sessionId}`,
        );
      }
    }

    this.clientSessions.delete(clientId);
  }

  /** 클라이언트가 붙어 있는 세션 ID */
  getSessionId(clientId: string): string | undefined {
    return this.clientSessions.get(clientId);
  }

  /** 세션에 붙어 있는 클라이언트 목록 */
  getClients(sessionId: string): Set<string> | undefined {
    return this.sessionClients.get(sessionId);
  }

  /** 세션에 접속 중인 클라이언트가 하나라도 있는지 */
  hasClients(sessionId: string): boolean {
    const clients = this.sessionClients.get(sessionId);
    return clients !== undefined && clients.size > 0;
  }

  /** 세션의 모든 매핑을 제거한다. */
  clearSession(sessionId: string): void {
    const clients = this.sessionClients.get(sessionId);
    if (!clients) {
      return;
    }

    clients.forEach((clientId) => {
      this.clientSessions.delete(clientId);
    });
    this.sessionClients.delete(sessionId);

    this.logger?.log(
      `[SessionMapper] Cleared all mappings for session ${sessionId}`,
    );
  }
}
