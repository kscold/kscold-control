import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { isScheduledBackupDue } from '../../domain/policies/backup-schedule.policy';
import {
  BACKUP_TARGET_REPOSITORY,
  type IBackupTargetRepository,
} from '../../domain/repositories/backup-target.repository';
import { BackupRunnerService } from './backup-runner.service';

/**
 * 예약 백업 스케줄러
 *
 * 대상마다 실행 시각이 다르고 화면에서 언제든 바뀔 수 있어, 시각별 크론을 등록하는 대신
 * 1분마다 깨어나 차례가 된 대상을 데이터베이스에서 찾는다.
 */
@Injectable()
export class BackupSchedulerService {
  private readonly logger = new Logger(BackupSchedulerService.name);

  /** 앞선 점검이 덤프를 기다리는 동안 다음 점검이 겹쳐 들어오지 않게 막는다. */
  private checking = false;

  constructor(
    @Inject(BACKUP_TARGET_REPOSITORY)
    private readonly targetRepository: IBackupTargetRepository,
    private readonly runner: BackupRunnerService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'backup-schedule' })
  async handleTick(): Promise<void> {
    if (this.checking) {
      return;
    }

    this.checking = true;
    try {
      await this.runDueTargets(new Date());
    } catch (error) {
      // 스케줄러 밖으로 예외가 새면 처리되지 않은 거부로 남으므로 여기서 기록하고 끝낸다.
      this.logger.error(`[백업] 예약 점검 실패: ${toMessage(error)}`);
    } finally {
      this.checking = false;
    }
  }

  /**
   * 차례가 된 대상을 하나씩 백업하고, 실행한 대상 수를 돌려준다.
   * 덤프가 호스트 자원을 한꺼번에 쓰지 않도록 동시에 돌리지 않는다.
   */
  async runDueTargets(now: Date): Promise<number> {
    let executed = 0;

    for (const target of await this.targetRepository.findEnabled()) {
      if (!isScheduledBackupDue(target, now)) {
        continue;
      }
      if (this.runner.isRunning(target.id)) {
        // 수동 실행이 끝난 뒤 다음 점검에서 다시 차례를 본다.
        continue;
      }

      // 기준 시각을 먼저 옮긴다. 덤프 도중 서버가 내려가도 같은 예약 시각을 되풀이하지 않는다.
      await this.targetRepository.moveScheduleCursor(target.id, now);
      try {
        await this.runner.runToCompletion(target.id, 'schedule');
        executed += 1;
      } catch (error) {
        // 한 대상에서 문제가 생겨도 나머지 대상은 계속 진행한다.
        this.logger.error(
          `[백업] ${target.name}: 예약 실행을 시작하지 못함 — ${toMessage(error)}`,
        );
      }
    }

    return executed;
  }
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
