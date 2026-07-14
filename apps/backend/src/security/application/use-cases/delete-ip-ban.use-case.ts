import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  IP_BAN_REPOSITORY,
  type IIpBanRepository,
} from '../../domain/repositories/ip-ban.repository';
import { ResyncBlocklistUseCase } from './resync-blocklist.use-case';
import type { IpBan } from '../../domain/entities/ip-ban.entity';

/** IP 차단 해제 — 비활성화 후 nginx 재동기화 */
@Injectable()
export class DeleteIpBanUseCase {
  constructor(
    @Inject(IP_BAN_REPOSITORY)
    private readonly repo: IIpBanRepository,
    private readonly resyncBlocklist: ResyncBlocklistUseCase,
  ) {}

  async execute(id: string): Promise<IpBan> {
    const ban = await this.repo.deactivate(id);
    if (!ban) {
      throw new NotFoundException('해당 차단 항목을 찾을 수 없습니다.');
    }
    await this.resyncBlocklist.execute();
    return ban;
  }
}
