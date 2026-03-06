import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../../domain/entities/permission.entity';
import { IPermissionRepository } from '../../domain/repositories/permission.repository.interface';

@Injectable()
export class TypeOrmPermissionRepository implements IPermissionRepository {
  constructor(
    @InjectRepository(Permission)
    private readonly repository: Repository<Permission>,
  ) {}

  async findByName(name: string): Promise<Permission | null> {
    return this.repository.findOne({ where: { name } });
  }

  async findAll(): Promise<Permission[]> {
    return this.repository.find();
  }

  create(data: Partial<Permission>): Permission {
    return this.repository.create(data);
  }

  async save(permission: Permission): Promise<Permission> {
    return this.repository.save(permission);
  }
}
