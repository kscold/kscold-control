import { Injectable } from '@nestjs/common';

@Injectable()
export class OpenAISessionMapperService {
  private readonly sessionClients = new Map<string, Set<string>>();
  private readonly clientSessions = new Map<string, string>();

  mapClientToSession(clientId: string, sessionId: string): void {
    this.clientSessions.set(clientId, sessionId);
    if (!this.sessionClients.has(sessionId)) {
      this.sessionClients.set(sessionId, new Set());
    }
    this.sessionClients.get(sessionId)!.add(clientId);
  }

  unmapClient(clientId: string): void {
    const sessionId = this.clientSessions.get(clientId);
    if (sessionId) {
      const clients = this.sessionClients.get(sessionId);
      if (clients) {
        clients.delete(clientId);
        if (clients.size === 0) this.sessionClients.delete(sessionId);
      }
      this.clientSessions.delete(clientId);
    }
  }

  getSessionId(clientId: string): string | undefined {
    return this.clientSessions.get(clientId);
  }

  getClients(sessionId: string): Set<string> | undefined {
    return this.sessionClients.get(sessionId);
  }

  clearSession(sessionId: string): void {
    const clients = this.sessionClients.get(sessionId);
    if (clients) {
      clients.forEach((cid) => this.clientSessions.delete(cid));
      this.sessionClients.delete(sessionId);
    }
  }
}
