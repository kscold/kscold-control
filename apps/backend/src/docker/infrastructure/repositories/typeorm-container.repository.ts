import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Container } from '../../domain/entities/container.entity';
import { IContainerRepository } from '../../domain/repositories/container.repository.interface';

/**
 * TypeORM Container Repository Implementation
 * Implements IContainerRepository using TypeORM
 */
@Injectable()
export class TypeOrmContainerRepository implements IContainerRepository {
  constructor(
    @InjectRepository(Container)
    private readonly repository: Repository<Container>,
  ) {}

  async findById(id: string): Promise<Container | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByDockerId(dockerId: string): Promise<Container | null> {
    return this.repository.findOne({ where: { dockerId } });
  }

  async findAll(): Promise<Container[]> {
    return this.repository.find();
  }

  async findByUserId(userId: string): Promise<Container[]> {
    return this.repository.find({ where: { userId } });
  }

  create(data: Partial<Container>): Container {
    return this.repository.create(data);
  }

  async save(container: Container): Promise<Container> {
    return this.repository.save(container);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async updateStatus(id: string, status: Container['status']): Promise<void> {
    await this.repository.update(id, { status });
  }
}
