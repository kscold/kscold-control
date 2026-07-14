import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  IP_BAN_REPOSITORY,
  type IIpBanRepository,
} from '../../domain/repositories/ip-ban.repository';
import { IpAllowlistService } from '../services/ip-allowlist.service';
import { ResyncBlocklistUseCase } from './resync-blocklist.use-case';
import type { IpBan, IpBanSource } from '../../domain/entities/ip-ban.entity';

export interface CreateBanParams {
  ip: string;
  reason: string | null;
  ttlMinutes: number | null;
  source?: IpBanSource;
  createdBy: string | null;
  requesterIp: string | null;
}

/** IP 차단 생성 — allowlist 보호 검증 후 저장하고 nginx 재동기화 */
@Injectable()
export class CreateIpBanUseCase {
  constructor(
    @Inject(IP_BAN_REPOSITORY)
    private readonly repo: IIpBanRepository,
    private readonly allowlist: IpAllowlistService,
    private readonly resyncBlocklist: ResyncBlocklistUseCase,
  ) {}

  async execute(params: CreateBanParams): Promise<IpBan> {
    const ip = params.ip.trim();
    const guard = this.allowlist.isProtected(ip, params.requesterIp);
    if (guard.protected) {
      throw new BadRequestException(guard.reason ?? '차단할 수 없는 IP입니다.');
    }

    const expiresAt =
      params.ttlMinutes && params.ttlMinutes > 0
        ? new Date(Date.now() + params.ttlMinutes * 60_000)
        : null;

    const ban = await this.repo.create({
      ip,
      reason: params.reason,
      source: params.source ?? 'manual',
      expiresAt,
      createdBy: params.createdBy,
    });

    await this.resyncBlocklist.execute();
    return ban;
  }
}
