import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { IUserRepository } from '../../domain/repositories/user.repository.interface';

/**
 * TypeORM User Repository Implementation
 * Infrastructure layer - implements domain repository interface
 */
@Injectable()
export class TypeOrmUserRepository implements IUserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({ where: { email } });
  }

  async findByEmailWithRoles(email: string): Promise<User | null> {
    return this.repository.findOne({
      where: { email },
      relations: ['roles', 'roles.permissions'],
    });
  }

  async findByIdWithRoles(id: string): Promise<User | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['roles', 'roles.permissions'],
    });
  }

  async findAll(): Promise<User[]> {
    return this.repository.find();
  }

  async findAllWithRoles(): Promise<User[]> {
    return this.repository.find({
      relations: ['roles', 'roles.permissions'],
    });
  }

  create(userData: Partial<User>): User {
    return this.repository.create(userData);
  }

  async save(user: User): Promise<User> {
    return this.repository.save(user);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async incrementTerminalCommandCount(userId: string): Promise<void> {
    await this.repository.increment({ id: userId }, 'terminalCommandCount', 1);
  }

  async resetTerminalCommandCount(userId: string): Promise<void> {
    await this.repository.update({ id: userId }, { terminalCommandCount: 0 });
  }

  async updateTerminalCommandLimit(
    userId: string,
    limit: number,
  ): Promise<User | null> {
    await this.repository.update(
      { id: userId },
      { terminalCommandLimit: limit },
    );
    return this.findById(userId);
  }
}
