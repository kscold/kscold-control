import { Injectable } from '@nestjs/common';

/**
 * Session Mapper Service
 * Application service for mapping WebSocket clients to terminal sessions
 */
@Injectable()
export class SessionMapperService {
  // sessionId -> Set<socketId> mapping (multi-client support)
  private readonly sessionClients = new Map<string, Set<string>>();

  // socketId -> sessionId mapping (fast lookup)
  private readonly clientSessions = new Map<string, string>();

  /**
   * Map a client to a session
   */
  mapClientToSession(clientId: string, sessionId: string): void {
    // Store client -> session mapping
    this.clientSessions.set(clientId, sessionId);

    // Store session -> clients mapping
    if (!this.sessionClients.has(sessionId)) {
      this.sessionClients.set(sessionId, new Set());
    }
    this.sessionClients.get(sessionId)!.add(clientId);

    console.log(
      `[SessionMapper] Mapped client ${clientId} to session ${sessionId}`,
    );
  }

  /**
   * Unmap a client from its session
   */
  unmapClient(clientId: string): void {
    const sessionId = this.clientSessions.get(clientId);
    if (sessionId) {
      // Remove from session's client set
      const clients = this.sessionClients.get(sessionId);
      if (clients) {
        clients.delete(clientId);
        console.log(
          `[SessionMapper] Unmapped client ${clientId} from session ${sessionId}. Remaining: ${clients.size}`,
        );

        // Clean up empty session
        if (clients.size === 0) {
          this.sessionClients.delete(sessionId);
          console.log(
            `[SessionMapper] No clients remaining for session ${sessionId}`,
          );
        }
      }

      // Remove client mapping
      this.clientSessions.delete(clientId);
    }
  }

  /**
   * Get session ID for a client
   */
  getSessionId(clientId: string): string | undefined {
    return this.clientSessions.get(clientId);
  }

  /**
   * Get all clients for a session
   */
  getClients(sessionId: string): Set<string> | undefined {
    return this.sessionClients.get(sessionId);
  }

  /**
   * Check if session has any connected clients
   */
  hasClients(sessionId: string): boolean {
    const clients = this.sessionClients.get(sessionId);
    return clients !== undefined && clients.size > 0;
  }

  /**
   * Clear all mappings for a session
   */
  clearSession(sessionId: string): void {
    const clients = this.sessionClients.get(sessionId);
    if (clients) {
      clients.forEach((clientId) => {
        this.clientSessions.delete(clientId);
      });
      this.sessionClients.delete(sessionId);
      console.log(
        `[SessionMapper] Cleared all mappings for session ${sessionId}`,
      );
    }
  }
}
