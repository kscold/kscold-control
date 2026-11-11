import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  IP_BAN_REPOSITORY,
  type IIpBanRepository,
} from '../../domain/repositories/ip-ban.repository';
import {
  NGINX_BLOCKLIST_WRITER,
  type INginxBlocklistWriter,
} from '../../domain/repositories/nginx-blocklist.writer';

export interface ResyncResult {
  reloaded: boolean;
  count: number;
}

/** 자동 차단을 nginx 에 모아서 반영하는 간격. 그동안에도 백엔드는 막힌 IP 의 로그인을 429 로 돌려보낸다. */
export const BATCHED_RESYNC_DELAY_MS = 10_000;

/**
 * 활성 IP 차단 목록을 nginx ip-blocklist.conf 에 재동기화.
 * 한 번에 하나만 돌린다. 겹쳐 돌면 늦게 읽은 목록이 먼저 쓰여 차단이 빠지거나, nginx -t 가 쓰다 만 파일을 읽는다.
 */
@Injectable()
export class ResyncBlocklistUseCase implements OnModuleDestroy {
  private readonly logger = new Logger(ResyncBlocklistUseCase.name);
  private running: Promise<ResyncResult> | null = null;
  private rerun: Promise<ResyncResult> | null = null;
  private batch: NodeJS.Timeout | null = null;

  constructor(
    @Inject(IP_BAN_REPOSITORY)
    private readonly repo: IIpBanRepository,
    @Inject(NGINX_BLOCKLIST_WRITER)
    private readonly blocklistWriter: INginxBlocklistWriter,
  ) {}

  /** 지금 반영한다. 반영 중이면 그 뒤에 한 번 더 돌려, 그사이 바뀐 차단까지 담는다. */
  execute(): Promise<ResyncResult> {
    if (!this.running) {
      this.running = this.apply().finally(() => {
        this.running = null;
      });
      return this.running;
    }
    this.rerun ??= this.running
      .catch(() => undefined)
      .then(() => {
        this.rerun = null;
        return this.execute();
      });
    return this.rerun;
  }

  /** 로그인 자동 차단처럼 몰려 오는 변경은 첫 요청부터 잠시 모았다가 한 번에 반영한다. */
  executeSoon(): void {
    if (this.batch) return;
    this.batch = setTimeout(() => {
      this.batch = null;
      this.execute().catch((error: Error) =>
        this.logger.error(`차단 목록 반영 실패: ${error.message}`),
      );
    }, BATCHED_RESYNC_DELAY_MS);
    this.batch.unref();
  }

  onModuleDestroy(): void {
    if (this.batch) clearTimeout(this.batch);
    this.batch = null;
  }

  private async apply(): Promise<ResyncResult> {
    const active = await this.repo.listActive();
    const result = await this.blocklistWriter.apply(
      active.map((ban) => ban.ip),
    );
    return { reloaded: result.reloaded, count: active.length };
  }
}
