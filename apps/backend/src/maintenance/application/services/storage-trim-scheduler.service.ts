import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  isDailyScheduleDue,
  isValidDailyScheduleTime,
  resolveNextRunAt,
} from '../../../common/scheduling/daily-schedule.policy';
import {
  STORAGE_TRIM_RUN_REPOSITORY,
  type IStorageTrimRunRepository,
} from '../../domain/repositories/storage-trim-run.repository';
import { TrimDockerDiskUseCase } from '../use-cases/trim-docker-disk.use-case';

/** 기본 예약 시각 — 작업 폴더 정리(04:30)가 끝난 뒤 */
export const DEFAULT_STORAGE_TRIM_TIME = '05:00';

/** STORAGE_TRIM_TIME 으로 시각을 바꾸고, off 로 끈다 */
export function storageTrimSchedule(env: NodeJS.ProcessEnv = process.env): {
  enabled: boolean;
  scheduleTime: string;
} {
  const value = (env.STORAGE_TRIM_TIME ?? DEFAULT_STORAGE_TRIM_TIME).trim();
  return isValidDailyScheduleTime(value)
    ? { enabled: true, scheduleTime: value }
    : { enabled: false, scheduleTime: DEFAULT_STORAGE_TRIM_TIME };
}

/**
 * 도커 VM 공간 반환 스케줄러
 * 자동 정리가 VM 안에서 지운 공간도 매일 맥으로 돌아오게 한다.
 * 서버를 막 띄웠을 때 지나간 예약을 몰아서 돌리지 않도록 기동 시각을 기준점으로 삼는다.
 */
@Injectable()
export class StorageTrimSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(StorageTrimSchedulerService.name);
  private readonly startedAt = new Date();
  private checking = false;

  constructor(
    @Inject(STORAGE_TRIM_RUN_REPOSITORY)
    private readonly runRepository: IStorageTrimRunRepository,
    private readonly trim: TrimDockerDiskUseCase,
  ) {}

  async onModuleInit(): Promise<void> {
    const closed = await this.runRepository.failUnfinished(
      '서버가 다시 시작돼 공간 반환 기록을 마치지 못했습니다.',
    );
    if (closed > 0) {
      this.logger.warn(
        `[공간 반환] 끝나지 않은 기록 ${closed}건을 실패로 닫음`,
      );
    }
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: 'storage-trim-schedule' })
  async handleTick(): Promise<void> {
    if (this.checking) return;
    this.checking = true;
    try {
      await this.runIfDue(new Date());
    } catch (error) {
      this.logger.error(
        `[공간 반환] 예약 실행 실패: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.checking = false;
    }
  }

  /** 다음 예약 시각. 꺼져 있으면 null */
  async nextRunAt(now: Date = new Date()): Promise<Date | null> {
    return resolveNextRunAt(await this.state(), now);
  }

  /** 차례가 됐으면 공간을 돌려주고 실행 여부를 돌려준다 */
  async runIfDue(now: Date): Promise<boolean> {
    if (this.trim.isRunning() || !isDailyScheduleDue(await this.state(), now)) {
      return false;
    }
    await this.trim.execute({ trigger: 'schedule' });
    return true;
  }

  private async state() {
    const schedule = storageTrimSchedule();
    const latest = await this.runRepository.findLatestScheduled();
    const cursor =
      latest && latest.startedAt > this.startedAt
        ? latest.startedAt
        : this.startedAt;
    return { ...schedule, scheduleCursorAt: cursor };
  }
}
