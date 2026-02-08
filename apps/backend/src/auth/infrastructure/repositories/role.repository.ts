import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../../entities/role.entity';
import { IRoleRepository } from '../../domain/repositories/role.repository.interface';

@Injectable()
export class RoleRepository implements IRoleRepository {
  constructor(
    @InjectRepository(Role)
    private readonly repository: Repository<Role>,
  ) {}

  async findByName(name: string): Promise<Role | null> {
    return this.repository.findOne({ where: { name } });
  }

  create(roleData: Partial<Role>): Role {
    return this.repository.create(roleData);
  }

  async save(role: Role): Promise<Role> {
    return this.repository.save(role);
  }
}
