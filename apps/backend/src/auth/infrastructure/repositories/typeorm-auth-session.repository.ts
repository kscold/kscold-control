import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
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

  async upgradeToMfa(id: string): Promise<void> {
    await this.repository.update({ id }, { assurance: 'mfa' });
  }

  revoke(id: string, at: Date): Promise<string[]> {
    return this.revokeWhere(
      at,
      new Brackets((where) =>
        where
          .where('id = :id', { id })
          .orWhere('parent_session_id = :id', { id }),
      ),
    );
  }

  revokeForUser(
    userId: string,
    at: Date,
    keepSessionId: string | null,
  ): Promise<string[]> {
    const owned = new Brackets((where) =>
      where
        .where('user_id = :userId', { userId })
        .orWhere(
          'parent_session_id IN (SELECT id FROM auth_sessions WHERE user_id = :userId)',
          { userId },
        ),
    );
    if (!keepSessionId) return this.revokeWhere(at, owned);
    return this.revokeWhere(
      at,
      new Brackets((where) =>
        where
          .where(owned)
          .andWhere('id <> :keep', { keep: keepSessionId })
          .andWhere('parent_session_id IS DISTINCT FROM :keep', {
            keep: keepSessionId,
          }),
      ),
    );
  }

  private async revokeWhere(at: Date, target: Brackets): Promise<string[]> {
    const result = await this.repository
      .createQueryBuilder()
      .update(AuthSession)
      .set({ revokedAt: at })
      .where('revoked_at IS NULL')
      .andWhere(target)
      .returning('id')
      .execute();
    return (result.raw as Array<{ id: string }>).map((row) => row.id);
  }
}
