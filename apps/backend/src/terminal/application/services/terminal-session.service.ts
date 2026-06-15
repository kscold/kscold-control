import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Session } from '../../domain/entities/session.entity';
import type { Message } from '../../domain/entities/message.entity';
import type { ISessionRepository } from '../../domain/interfaces/session.repository.interface';
import type { IMessageRepository } from '../../domain/interfaces/message.repository.interface';
import { SESSION_REPOSITORY } from '../../domain/interfaces/session.repository.interface';
import { MESSAGE_REPOSITORY } from '../../domain/interfaces/message.repository.interface';

@Injectable()
export class TerminalSessionService {
  private readonly logger = new Logger(TerminalSessionService.name);

  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepo: ISessionRepository,
    @Inject(MESSAGE_REPOSITORY)
    private readonly messageRepo: IMessageRepository,
  ) {}

  /**
   * Find existing active session or create a new one.
   * Returns the session and whether this is a reconnection.
   */
  async getOrCreateSession(
    userId: string,
    requestedSessionId?: string,
  ): Promise<{ session: Session; isReconnect: boolean }> {
    if (requestedSessionId) {
      const existing = await this.sessionRepo.findActive(
        requestedSessionId,
        userId,
      );
      if (existing) {
        this.logger.log(`Reconnecting to session: ${existing.id}`);
        return { session: existing, isReconnect: true };
      }
    }

    const session = this.sessionRepo.create({
      userId,
      title: `Terminal ${new Date().toLocaleString()}`,
      isActive: true,
      lastActivityAt: new Date(),
    });
    const saved = await this.sessionRepo.save(session);
    this.logger.log(`Created new session: ${saved.id}`);
    return { session: saved, isReconnect: false };
  }

  async getHistory(sessionId: string): Promise<Message[]> {
    return this.messageRepo.findBySession(sessionId);
  }

  async saveMessage(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
  ): Promise<void> {
    const message = this.messageRepo.create({ sessionId, role, content });
    await this.messageRepo.save(message);
  }

  async clearHistory(sessionId: string): Promise<void> {
    await this.messageRepo.deleteBySession(sessionId);
  }

  async updateActivity(sessionId: string): Promise<void> {
    await this.sessionRepo.updateActivity(sessionId);
  }

  /**
   * Close a session: deactivate it and return the session id.
   */
  async closeSession(sessionId: string): Promise<void> {
    await this.sessionRepo.deactivate(sessionId);
  }

  /**
   * Delete a session and all its messages.
   * Returns null if session not found or doesn't belong to user.
   */
  async deleteSession(
    sessionId: string,
    userId: string,
  ): Promise<Session | null> {
    const session = await this.sessionRepo.findByIdForUser(sessionId, userId);
    if (!session) return null;

    await this.messageRepo.deleteBySession(sessionId);
    await this.sessionRepo.delete(sessionId);
    return session;
  }

  async createNamedSession(userId: string, title: string): Promise<Session> {
    const session = this.sessionRepo.create({
      userId,
      title: title || 'New Session',
      isActive: true,
    });
    return this.sessionRepo.save(session);
  }

  async loadSessionWithMessages(sessionId: string): Promise<Session | null> {
    return this.sessionRepo.findWithMessages(sessionId);
  }

  async touchSession(session: Session): Promise<void> {
    session.lastActivityAt = new Date();
    await this.sessionRepo.save(session);
  }
}
