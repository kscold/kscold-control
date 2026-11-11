import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserMfa } from '../domain/user-mfa.entity';
import type { IUserMfaRepository } from '../domain/user-mfa.repository.interface';

@Injectable()
export class TypeOrmUserMfaRepository implements IUserMfaRepository {
  constructor(
    @InjectRepository(UserMfa)
    private readonly repository: Repository<UserMfa>,
  ) {}

  find(userId: string): Promise<UserMfa | null> {
    return this.repository.findOneBy({ userId });
  }

  async createIfAbsent(enrollment: UserMfa): Promise<boolean> {
    const result = await this.repository
      .createQueryBuilder()
      .insert()
      .into(UserMfa)
      .values(enrollment)
      .orIgnore()
      .returning('user_id')
      .execute();
    return (result.raw as unknown[]).length > 0;
  }

  async claimTotpStep(userId: string, step: number): Promise<boolean> {
    const result = await this.repository
      .createQueryBuilder()
      .update(UserMfa)
      .set({ lastUsedStep: step })
      .where('user_id = :userId', { userId })
      .andWhere('last_used_step < :step', { step })
      .execute();
    return (result.affected ?? 0) > 0;
  }

  async consumeRecoveryCode(
    userId: string,
    codeHash: string,
  ): Promise<boolean> {
    const result = await this.repository
      .createQueryBuilder()
      .update(UserMfa)
      .set({
        recoveryCodeHashes: () =>
          'array_remove(recovery_code_hashes, :codeHash)',
      })
      .where('user_id = :userId', { userId })
      .andWhere(':codeHash = ANY(recovery_code_hashes)')
      .setParameters({ codeHash })
      .execute();
    return (result.affected ?? 0) > 0;
  }

  async replaceRecoveryCodes(
    userId: string,
    codeHashes: string[],
  ): Promise<void> {
    await this.repository.update(
      { userId },
      { recoveryCodeHashes: codeHashes },
    );
  }
}
