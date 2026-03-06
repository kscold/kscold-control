import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../../domain/entities/message.entity';
import type { IMessageRepository } from '../../domain/interfaces/message.repository.interface';

@Injectable()
export class TypeOrmMessageRepository implements IMessageRepository {
  constructor(
    @InjectRepository(Message)
    private readonly repo: Repository<Message>,
  ) {}

  async findBySession(sessionId: string): Promise<Message[]> {
    return this.repo.find({
      where: { sessionId },
      order: { timestamp: 'ASC' },
    });
  }

  create(data: Partial<Message>): Message {
    return this.repo.create(data);
  }

  async save(message: Message): Promise<Message> {
    return this.repo.save(message);
  }

  async deleteBySession(sessionId: string): Promise<void> {
    await this.repo.delete({ sessionId });
  }
}
