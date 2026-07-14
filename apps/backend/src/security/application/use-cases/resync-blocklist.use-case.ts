import { Inject, Injectable } from '@nestjs/common';
import {
  IP_BAN_REPOSITORY,
  type IIpBanRepository,
} from '../../domain/repositories/ip-ban.repository';
import {
  NGINX_BLOCKLIST_WRITER,
  type INginxBlocklistWriter,
} from '../../domain/repositories/nginx-blocklist.writer';

/** 활성 IP 차단 목록을 nginx ip-blocklist.conf 에 재동기화 */
@Injectable()
export class ResyncBlocklistUseCase {
  constructor(
    @Inject(IP_BAN_REPOSITORY)
    private readonly repo: IIpBanRepository,
    @Inject(NGINX_BLOCKLIST_WRITER)
    private readonly blocklistWriter: INginxBlocklistWriter,
  ) {}

  async execute(): Promise<{ reloaded: boolean; count: number }> {
    const active = await this.repo.listActive();
    const result = await this.blocklistWriter.apply(
      active.map((ban) => ban.ip),
    );
    return { reloaded: result.reloaded, count: active.length };
  }
}
