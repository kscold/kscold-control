import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  IP_BAN_REPOSITORY,
  type IIpBanRepository,
} from '../../domain/repositories/ip-ban.repository';
import { ResyncBlocklistUseCase } from '../use-cases/resync-blocklist.use-case';

const EXPIRE_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * IP 차단 부팅/백그라운드 라이프사이클 담당 서비스.
 * - 부팅 시 nginx ip-blocklist.conf 재동기화
 * - 주기적으로 만료된 차단을 정리하고 재동기화
 *
 * 컨트롤러 엔드포인트 로직(list/create/remove/resync)은 application/use-cases 로 이동함.
 */
@Injectable()
export class IpBanService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IpBanService.name);
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(IP_BAN_REPOSITORY)
    private readonly repo: IIpBanRepository,
    private readonly resyncBlocklist: ResyncBlocklistUseCase,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.resyncBlocklist.execute();
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

  private async sweepExpired(): Promise<void> {
    try {
      const expired = await this.repo.removeExpired(new Date());
      if (expired.length === 0) return;
      this.logger.log(`${expired.length}건 만료 처리`);
      await this.resyncBlocklist.execute();
    } catch (error) {
      this.logger.error(`만료 처리 실패: ${(error as Error).message}`);
    }
  }
}
