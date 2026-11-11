import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { LoginAttempt } from '../../domain/entities/login-attempt.entity';
import type { ILoginAttemptRepository } from '../../domain/repositories/login-attempt.repository';
import type { LoginAttemptRecord } from '../../domain/login-guard/login-block.policy';

@Injectable()
export class LoginAttemptRepositoryImpl implements ILoginAttemptRepository {
  constructor(
    @InjectRepository(LoginAttempt)
    private readonly repo: Repository<LoginAttempt>,
  ) {}

  async append(attempt: LoginAttemptRecord): Promise<void> {
    await this.repo.insert({
      ip: attempt.ip,
      ipGroup: attempt.ipGroup,
      account: attempt.account,
      origin: attempt.origin,
      result: attempt.result,
      reason: attempt.reason,
      createdAt: attempt.at,
    });
  }

  async recent(query: {
    ipGroup: string | null;
    ipSince: Date;
    account: string;
    accountSince: Date;
  }): Promise<LoginAttemptRecord[]> {
    const rows = await this.repo
      .createQueryBuilder('attempt')
      .select([
        'attempt.ip',
        'attempt.ipGroup',
        'attempt.account',
        'attempt.origin',
        'attempt.result',
        'attempt.reason',
        'attempt.createdAt',
      ])
      .where(
        '(attempt.ipGroup = :ipGroup AND attempt.createdAt > :ipSince) OR (attempt.account = :account AND attempt.createdAt > :accountSince)',
        query,
      )
      .getMany();
    return rows.map((row) => ({
      ip: row.ip,
      ipGroup: row.ipGroup,
      account: row.account,
      origin: row.origin,
      result: row.result,
      reason: row.reason,
      at: row.createdAt,
    }));
  }

  async deleteBefore(cutoff: Date): Promise<number> {
    const result = await this.repo.delete({ createdAt: LessThan(cutoff) });
    return result.affected ?? 0;
  }
}
