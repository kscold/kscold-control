import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '../../domain/entities/session.entity';
import type { ISessionRepository } from '../../domain/interfaces/session.repository.interface';

@Injectable()
export class TypeOrmSessionRepository implements ISessionRepository {
  constructor(
    @InjectRepository(Session)
    private readonly repo: Repository<Session>,
  ) {}

  async findActive(sessionId: string, userId: string): Promise<Session | null> {
    return this.repo.findOne({
      where: { id: sessionId, userId, isActive: true },
    });
  }

  async findWithMessages(sessionId: string): Promise<Session | null> {
    return this.repo.findOne({
      where: { id: sessionId },
      relations: { messages: true },
    });
  }

  async findById(sessionId: string): Promise<Session | null> {
    return this.repo.findOne({ where: { id: sessionId } });
  }

  async findByIdForUser(
    sessionId: string,
    userId: string,
  ): Promise<Session | null> {
    return this.repo.findOne({ where: { id: sessionId, userId } });
  }

  create(data: Partial<Session>): Session {
    return this.repo.create(data);
  }

  async save(session: Session): Promise<Session> {
    return this.repo.save(session);
  }

  async updateActivity(sessionId: string): Promise<void> {
    await this.repo.update(sessionId, { lastActivityAt: new Date() });
  }

  async deactivate(sessionId: string): Promise<void> {
    await this.repo.update(sessionId, { isActive: false });
  }

  async delete(sessionId: string): Promise<void> {
    await this.repo.delete(sessionId);
  }
}
