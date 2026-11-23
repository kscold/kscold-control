import type { IpBan, IpBanSource } from '../entities/ip-ban.entity';

export const IP_BAN_REPOSITORY = Symbol('IP_BAN_REPOSITORY');

export interface CreateIpBanInput {
  ip: string;
  reason: string | null;
  source: IpBanSource;
  expiresAt: Date | null;
  createdBy: string | null;
}

export interface IIpBanRepository {
  list(): Promise<IpBan[]>;
  listActive(): Promise<IpBan[]>;
  findByIp(ip: string): Promise<IpBan | null>;
  findById(id: string): Promise<IpBan | null>;
  create(input: CreateIpBanInput): Promise<IpBan>;
  deactivate(id: string): Promise<IpBan | null>;
  removeExpired(now: Date): Promise<IpBan[]>;
  /** 만료로 풀린 지 오래된 차단 행을 지운다. 지운 행 수를 돌려준다. */
  deleteExpiredBefore(cutoff: Date): Promise<number>;
}
