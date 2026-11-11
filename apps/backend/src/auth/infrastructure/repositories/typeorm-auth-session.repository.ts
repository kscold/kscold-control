import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { AuthSession } from '../../domain/entities/auth-session.entity';
import type {
  IAuthSessionRepository,
  OpenAuthSessionInput,
} from '../../domain/repositories/auth-session.repository.interface';

@Injectable()
export class TypeOrmAuthSessionRepository implements IAuthSessionRepository {
  constructor(
    @InjectRepository(AuthSession)
    private readonly repository: Repository<AuthSession>,
  ) {}

  open(input: OpenAuthSessionInput): Promise<AuthSession> {
    return this.repository.save(
      this.repository.create({
        ...input,
        lastSeenAt: input.createdAt,
        stepUpUntil: null,
        revokedAt: null,
      }),
    );
  }

  findById(id: string): Promise<AuthSession | null> {
    return this.repository.findOneBy({ id });
  }

  async extend(id: string, expiresAt: Date): Promise<void> {
    await this.repository.update({ id }, { expiresAt });
  }

  async touch(id: string, at: Date): Promise<void> {
    await this.repository.update({ id }, { lastSeenAt: at });
  }

  async revoke(id: string, at: Date): Promise<void> {
    await this.repository.update(
      [
        { id, revokedAt: IsNull() },
        { parentSessionId: id, revokedAt: IsNull() },
      ],
      { revokedAt: at },
    );
  }
}
