import { Inject, Injectable } from '@nestjs/common';
import {
  IP_BAN_REPOSITORY,
  type IIpBanRepository,
} from '../../domain/repositories/ip-ban.repository';
import type { IpBan } from '../../domain/entities/ip-ban.entity';

/** 전체 IP 차단 목록 조회 */
@Injectable()
export class ListIpBansUseCase {
  constructor(
    @Inject(IP_BAN_REPOSITORY)
    private readonly repo: IIpBanRepository,
  ) {}

  execute(): Promise<IpBan[]> {
    return this.repo.list();
  }
}
