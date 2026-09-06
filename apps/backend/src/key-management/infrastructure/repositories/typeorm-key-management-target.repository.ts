import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KeyManagementTargetEntity } from '../../domain/entities/key-management-target.entity';
import { IKeyManagementTargetRepository } from '../../domain/repositories/key-management-target.repository.interface';

@Injectable()
export class TypeOrmKeyManagementTargetRepository implements IKeyManagementTargetRepository {
  constructor(
    @InjectRepository(KeyManagementTargetEntity)
    private readonly repository: Repository<KeyManagementTargetEntity>,
  ) {}

  findEnabled(): Promise<KeyManagementTargetEntity[]> {
    return this.baseQuery()
      .where('target.enabled = true')
      .orderBy('target.sortOrder', 'ASC')
      .addOrderBy('target.id', 'ASC')
      .getMany();
  }

  findEnabledById(id: string): Promise<KeyManagementTargetEntity | null> {
    return this.baseQuery()
      .where('target.id = :id', { id })
      .andWhere('target.enabled = true')
      .getOne();
  }

  private baseQuery() {
    return this.repository
      .createQueryBuilder('target')
      .addSelect('target.secretConfig')
      .addSelect('target.deploymentConfig');
  }
}
