import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  IP_BAN_REPOSITORY,
  type IIpBanRepository,
} from '../../domain/interfaces/ip-ban.repository';
import {
  NGINX_BLOCKLIST_WRITER,
  type INginxBlocklistWriter,
} from '../../domain/interfaces/nginx-blocklist.writer';
import { IpAllowlistService } from './ip-allowlist.service';
import type { IpBan, IpBanSource } from '../../domain/entities/ip-ban.entity';

export interface CreateBanParams {
  ip: string;
  reason: string | null;
  ttlMinutes: number | null;
  source?: IpBanSource;
  createdBy: string | null;
  requesterIp: string | null;
}

const EXPIRE_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

@Injectable()
export class IpBanService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IpBanService.name);
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(IP_BAN_REPOSITORY)
    private readonly repo: IIpBanRepository,
    @Inject(NGINX_BLOCKLIST_WRITER)
    private readonly blocklistWriter: INginxBlocklistWriter,
    private readonly allowlist: IpAllowlistService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.syncNginxBlocklist();
      this.logger.log('초기 ip-blocklist.conf 재동기화 완료');
    } catch (error) {
      this.logger.error(
        `초기 ip-blocklist.conf 재동기화 실패: ${(error as Error).message}`,
      );
    }

    this.sweepTimer = setInterval(() => {
      void this.sweepExpired();
    }, EXPIRE_SWEEP_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }

  list(): Promise<IpBan[]> {
    return this.repo.list();
  }

  listActive(): Promise<IpBan[]> {
    return this.repo.listActive();
  }

  async create(params: CreateBanParams): Promise<IpBan> {
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

    await this.syncNginxBlocklist();
    return ban;
  }

  async remove(id: string): Promise<IpBan> {
    const ban = await this.repo.deactivate(id);
    if (!ban) {
      throw new NotFoundException('해당 차단 항목을 찾을 수 없습니다.');
    }
    await this.syncNginxBlocklist();
    return ban;
  }

  async syncNginxBlocklist(): Promise<{ reloaded: boolean; count: number }> {
    const active = await this.repo.listActive();
    const result = await this.blocklistWriter.apply(
      active.map((ban) => ban.ip),
    );
    return { reloaded: result.reloaded, count: active.length };
  }

  private async sweepExpired(): Promise<void> {
    try {
      const expired = await this.repo.removeExpired(new Date());
      if (expired.length === 0) return;
      this.logger.log(`${expired.length}건 만료 처리`);
      await this.syncNginxBlocklist();
    } catch (error) {
      this.logger.error(`만료 처리 실패: ${(error as Error).message}`);
    }
  }
}
