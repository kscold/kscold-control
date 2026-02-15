import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Role } from '../../domain/entities/role.entity';
import { IRoleRepository } from '../../domain/repositories/role.repository.interface';

/**
 * TypeORM Role Repository Implementation
 * Infrastructure layer - implements domain repository interface
 */
@Injectable()
export class TypeOrmRoleRepository implements IRoleRepository {
  constructor(
    @InjectRepository(Role)
    private readonly repository: Repository<Role>,
  ) {}

  async findById(id: string): Promise<Role | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByName(name: string): Promise<Role | null> {
    return this.repository.findOne({ where: { name } });
  }

  async findByNameWithPermissions(name: string): Promise<Role | null> {
    return this.repository.findOne({
      where: { name },
      relations: ['permissions'],
    });
  }

  async findAll(): Promise<Role[]> {
    return this.repository.find();
  }

  async findAllWithPermissions(): Promise<Role[]> {
    return this.repository.find({
      relations: ['permissions'],
    });
  }

  async findByIds(ids: string[]): Promise<Role[]> {
    return this.repository.findBy({ id: In(ids) });
  }

  async findByIdsWithPermissions(ids: string[]): Promise<Role[]> {
    return this.repository.find({
      where: { id: In(ids) },
      relations: ['permissions'],
    });
  }

  create(roleData: Partial<Role>): Role {
    return this.repository.create(roleData);
  }

  async save(role: Role): Promise<Role> {
    return this.repository.save(role);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
