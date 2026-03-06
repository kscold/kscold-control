import type { Session } from '../entities/session.entity';

export interface ISessionRepository {
  findActive(sessionId: string, userId: string): Promise<Session | null>;
  findWithMessages(sessionId: string): Promise<Session | null>;
  findById(sessionId: string): Promise<Session | null>;
  findByIdForUser(sessionId: string, userId: string): Promise<Session | null>;
  create(data: Partial<Session>): Session;
  save(session: Session): Promise<Session>;
  updateActivity(sessionId: string): Promise<void>;
  deactivate(sessionId: string): Promise<void>;
  delete(sessionId: string): Promise<void>;
}

export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');
