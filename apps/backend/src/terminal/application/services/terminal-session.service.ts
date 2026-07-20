import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import type { Session } from '../../domain/entities/session.entity';
import type { Message } from '../../domain/entities/message.entity';
import type { ISessionRepository } from '../../domain/repositories/session.repository.interface';
import type { IMessageRepository } from '../../domain/repositories/message.repository.interface';
import type { ISessionManager } from '../../domain/ports/session-manager.port';
import { SESSION_REPOSITORY } from '../../domain/repositories/session.repository.interface';
import { MESSAGE_REPOSITORY } from '../../domain/repositories/message.repository.interface';

/**
 * 터미널 세션/메시지 관리 구현체
 * ISessionManager 포트의 구현이며, 외부 모듈은 SESSION_MANAGER 토큰으로 이 구현을 주입받는다.
 */
@Injectable()
export class TerminalSessionService implements ISessionManager {
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
   * 세션 닫기 — 세션을 비활성화한다.
   */
  async closeSession(sessionId: string, userId: string): Promise<void> {
    await this.requireSessionOwner(sessionId, userId);
    await this.sessionRepo.deactivate(sessionId);
  }

  /**
   * 세션과 소속 메시지 전체를 삭제한다.
   * 세션이 없거나 해당 유저의 것이 아니면 null을 반환한다.
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
