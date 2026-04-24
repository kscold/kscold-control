import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { IpBan } from '../../domain/entities/ip-ban.entity';
import type {
  CreateIpBanInput,
  IIpBanRepository,
} from '../../domain/interfaces/ip-ban.repository';

@Injectable()
export class IpBanRepositoryImpl implements IIpBanRepository {
  constructor(
    @InjectRepository(IpBan)
    private readonly repo: Repository<IpBan>,
  ) {}

  list(): Promise<IpBan[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  listActive(): Promise<IpBan[]> {
    return this.repo.find({
      where: { active: true },
      order: { createdAt: 'DESC' },
    });
  }

  findByIp(ip: string): Promise<IpBan | null> {
    return this.repo.findOne({ where: { ip } });
  }

  findById(id: string): Promise<IpBan | null> {
    return this.repo.findOne({ where: { id } });
  }

  async create(input: CreateIpBanInput): Promise<IpBan> {
    const existing = await this.repo.findOne({ where: { ip: input.ip } });
    if (existing) {
      existing.reason = input.reason;
      existing.source = input.source;
      existing.expiresAt = input.expiresAt;
      existing.active = true;
      existing.createdBy = input.createdBy ?? existing.createdBy;
      return this.repo.save(existing);
    }
    const entity = this.repo.create({
      ip: input.ip,
      reason: input.reason,
      source: input.source,
      expiresAt: input.expiresAt,
      createdBy: input.createdBy,
      active: true,
    });
    return this.repo.save(entity);
  }

  async deactivate(id: string): Promise<IpBan | null> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) return null;
    entity.active = false;
    return this.repo.save(entity);
  }

  async removeExpired(now: Date): Promise<IpBan[]> {
    const expired = await this.repo.find({
      where: { active: true, expiresAt: LessThan(now) },
    });
    if (expired.length === 0) return [];
    for (const ban of expired) ban.active = false;
    await this.repo.save(expired);
    return expired;
  }
}
