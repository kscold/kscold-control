import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import type { Session } from '../../domain/entities/session.entity';
import type { Message } from '../../domain/entities/message.entity';
import type { ISessionRepository } from '../../domain/repositories/session.repository.interface';
import type { IMessageRepository } from '../../domain/repositories/message.repository.interface';
import { SESSION_REPOSITORY } from '../../domain/repositories/session.repository.interface';
import { MESSAGE_REPOSITORY } from '../../domain/repositories/message.repository.interface';

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
   * 활성 세션을 찾거나 새로 생성한다.
   * 세션과 재접속 여부를 함께 반환한다.
   * titlePrefix: 새 세션 제목 접두어 — 터미널/claude-chat/openai-chat 게이트웨이가 공유하므로 호출자별로 구분
   */
  async getOrCreateSession(
    userId: string,
    requestedSessionId?: string,
    titlePrefix = 'Terminal',
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
      title: `${titlePrefix} ${new Date().toLocaleString()}`,
      isActive: true,
      lastActivityAt: new Date(),
    });
    const saved = await this.sessionRepo.save(session);
    this.logger.log(`Created new session: ${saved.id}`);
    return { session: saved, isReconnect: false };
  }

  async getHistory(sessionId: string, userId: string): Promise<Message[]> {
    await this.requireSessionOwner(sessionId, userId);
    return this.messageRepo.findBySession(sessionId);
  }

  async saveMessage(
    sessionId: string,
    userId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.requireSessionOwner(sessionId, userId);
    const message = this.messageRepo.create({
      sessionId,
      role,
      content,
      ...(metadata ? { metadata } : {}),
    });
    await this.messageRepo.save(message);
  }

  async clearHistory(sessionId: string, userId: string): Promise<void> {
    await this.requireSessionOwner(sessionId, userId);
    await this.messageRepo.deleteBySession(sessionId);
  }

  async updateActivity(sessionId: string, userId: string): Promise<void> {
    await this.requireSessionOwner(sessionId, userId);
    await this.sessionRepo.updateActivity(sessionId);
  }

  /**
   * Close a session: deactivate it and return the session id.
   */
  async closeSession(sessionId: string, userId: string): Promise<void> {
    await this.requireSessionOwner(sessionId, userId);
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

  async loadSessionWithMessages(
    sessionId: string,
    userId: string,
  ): Promise<Session | null> {
    await this.requireSessionOwner(sessionId, userId);
    return this.sessionRepo.findWithMessages(sessionId);
  }

  async touchSession(session: Session): Promise<void> {
    session.lastActivityAt = new Date();
    await this.sessionRepo.save(session);
  }

  private async requireSessionOwner(
    sessionId: string,
    userId: string,
  ): Promise<Session> {
    const session = await this.sessionRepo.findByIdForUser(sessionId, userId);
    if (!session) {
      throw new NotFoundException('터미널 세션을 찾을 수 없습니다.');
    }

    return session;
  }
}
