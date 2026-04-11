import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../../domain/entities/project.entity';
import { IProjectRepository } from '../../domain/repositories/project.repository.interface';

@Injectable()
export class TypeOrmProjectRepository implements IProjectRepository {
  constructor(
    @InjectRepository(Project)
    private readonly repo: Repository<Project>,
  ) {}

  findAll(): Promise<Project[]> {
    return this.repo.find({ order: { updatedAt: 'DESC' } });
  }

  findById(id: string): Promise<Project | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByName(name: string): Promise<Project | null> {
    return this.repo.findOne({ where: { name } });
  }

  create(data: Partial<Project>): Promise<Project> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(id: string, data: Partial<Project>): Promise<Project> {
    await this.repo.update(id, data);
    return this.repo.findOneOrFail({ where: { id } });
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
