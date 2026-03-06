import type { Message } from '../entities/message.entity';

export interface IMessageRepository {
  findBySession(sessionId: string): Promise<Message[]>;
  create(data: Partial<Message>): Message;
  save(message: Message): Promise<Message>;
  deleteBySession(sessionId: string): Promise<void>;
}

export const MESSAGE_REPOSITORY = Symbol('MESSAGE_REPOSITORY');
