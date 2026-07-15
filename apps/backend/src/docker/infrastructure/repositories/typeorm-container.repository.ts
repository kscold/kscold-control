import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Container } from '../../domain/entities/container.entity';
import { IContainerRepository } from '../../domain/repositories/container.repository.interface';

/**
 * TypeORM 기반 컨테이너 영속성 저장소 구현체임.
 * 도메인 저장소 계약을 PostgreSQL 접근 방식으로 연결함.
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

  async findByName(name: string): Promise<Container | null> {
    return this.repository.findOne({ where: { name } });
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
