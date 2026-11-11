import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { LoginAttempt } from '../../domain/entities/login-attempt.entity';
import type { ILoginAttemptRepository } from '../../domain/repositories/login-attempt.repository';
import type {
  LoginAttemptRecord,
  LoginOrigin,
} from '../../domain/login-guard/login-block.policy';

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
    origin: LoginOrigin;
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
      // 판정은 성공을 세지 않는다. 자주 쓰는 주소일수록 성공 행이 쌓여 로그인마다 읽는 양이 늘지 않게 뺀다.
      .where(
        "(attempt.ipGroup = :ipGroup AND attempt.createdAt > :ipSince AND attempt.result <> 'success')" +
          " OR (attempt.account = :account AND attempt.origin = :origin AND attempt.createdAt > :accountSince AND attempt.result = 'failure')",
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

  async failuresByIp(
    since: Date,
  ): Promise<Array<{ ip: string; failures: number; lastAt: Date }>> {
    const rows = await this.repo
      .createQueryBuilder('attempt')
      .select('attempt.ip', 'ip')
      .addSelect('COUNT(*)::int', 'failures')
      .addSelect('MAX(attempt.createdAt)', 'lastAt')
      .where('attempt.createdAt >= :since', { since })
      .andWhere("attempt.result <> 'success'")
      .andWhere('attempt.ip IS NOT NULL')
      .groupBy('attempt.ip')
      .getRawMany<{ ip: string; failures: number; lastAt: Date | string }>();
    return rows.map((row) => ({
      ip: row.ip,
      failures: Number(row.failures),
      lastAt: new Date(row.lastAt),
    }));
  }

  async deleteBefore(cutoff: Date): Promise<number> {
    const result = await this.repo.delete({ createdAt: LessThan(cutoff) });
    return result.affected ?? 0;
  }
}
