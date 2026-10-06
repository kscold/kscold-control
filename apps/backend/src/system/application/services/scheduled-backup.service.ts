import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  SCHEDULED_BACKUP_CRON,
  SCHEDULED_BACKUP_TIME_ZONE,
} from '../../domain/policies/scheduled-backup.policy';
import {
  EXTERNAL_MONGODB_BACKUP_REPOSITORY,
  type IExternalMongodbBackupRepository,
} from '../../domain/repositories/external-mongodb-backup.repository';
import {
  SCHEDULED_BACKUP_RUN_REPOSITORY,
  type IScheduledBackupRunRepository,
} from '../../domain/repositories/scheduled-backup-run.repository';
import {
  SCHEDULED_BACKUP_TARGET_REPOSITORY,
  type IScheduledBackupTargetRepository,
} from '../../domain/repositories/scheduled-backup-target.repository';
import type {
  ScheduledBackupRun,
  ScheduledBackupTarget,
  ScheduledBackupTrigger,
} from '../../domain/types/scheduled-backup.type';

/** 외부 MongoDB 예약 백업의 실행 순서(덤프 → 보관 기간 정리 → 결과 기록)를 맡는다. */
@Injectable()
export class ScheduledBackupService implements OnModuleInit {
  private readonly logger = new Logger(ScheduledBackupService.name);

  /** 같은 대상의 백업이 겹쳐 돌지 않게 막는 실행 중 표시 */
  private readonly running = new Set<string>();

  constructor(
    @Inject(SCHEDULED_BACKUP_TARGET_REPOSITORY)
    private readonly targetRepository: IScheduledBackupTargetRepository,
    @Inject(EXTERNAL_MONGODB_BACKUP_REPOSITORY)
    private readonly backupRepository: IExternalMongodbBackupRepository,
    @Inject(SCHEDULED_BACKUP_RUN_REPOSITORY)
    private readonly runRepository: IScheduledBackupRunRepository,
  ) {}

  /**
   * 기동할 때 설정을 한 번 읽어 둔다.
   * 설정이 잘못됐을 때 첫 실행 시각까지 기다리지 않고 기동 로그에서 바로 알 수 있다.
   */
  onModuleInit(): void {
    const targets = this.targetRepository.findAll();
    if (targets.length === 0) {
      return;
    }

    this.logger.log(
      `[예약 백업] 일정 ${SCHEDULED_BACKUP_CRON} (${SCHEDULED_BACKUP_TIME_ZONE}) — ` +
        targets
          .map((target) => `${target.name}(보관 ${target.retentionDays}일)`)
          .join(', '),
    );
  }

  /**
   * 설정된 외부 MongoDB 를 매일 03:30(KST)에 백업한다.
   * 등록된 대상이 없으면 아무 일도 하지 않는다.
   */
  @Cron(SCHEDULED_BACKUP_CRON, {
    name: 'scheduled-mongodb-backup',
    timeZone: SCHEDULED_BACKUP_TIME_ZONE,
  })
  async handleSchedule(): Promise<void> {
    try {
      await this.runAll('schedule');
    } catch (error) {
      // 스케줄러 밖으로 예외가 새면 처리되지 않은 거부로 남으므로 여기서 기록하고 끝낸다.
      this.logger.error(`[예약 백업] 실행 실패: ${toMessage(error)}`);
    }
  }

  listTargets(): ScheduledBackupTarget[] {
    return this.targetRepository.findAll();
  }

  isRunning(targetName: string): boolean {
    return this.running.has(targetName);
  }

  /** 모든 대상을 차례로 백업한다. 한 대상이 실패해도 나머지는 계속 진행한다. */
  async runAll(trigger: ScheduledBackupTrigger): Promise<ScheduledBackupRun[]> {
    const runs: ScheduledBackupRun[] = [];

    for (const target of this.targetRepository.findAll()) {
      if (this.running.has(target.name)) {
        this.logger.warn(`[예약 백업] ${target.name}: 이미 진행 중이라 건너뜀`);
        continue;
      }
      runs.push(await this.run(target, trigger));
    }

    return runs;
  }

  /** 대상 하나를 지금 백업한다. */
  async runTarget(
    targetName: string,
    trigger: ScheduledBackupTrigger,
  ): Promise<ScheduledBackupRun> {
    const target = this.targetRepository
      .findAll()
      .find((candidate) => candidate.name === targetName);

    if (!target) {
      throw new NotFoundException('등록되지 않은 예약 백업 대상입니다.');
    }
    if (this.running.has(target.name)) {
      throw new ConflictException('이미 백업이 진행 중입니다.');
    }

    return this.run(target, trigger);
  }

  private async run(
    target: ScheduledBackupTarget,
    trigger: ScheduledBackupTrigger,
  ): Promise<ScheduledBackupRun> {
    this.running.add(target.name);
    const startedAt = new Date().toISOString();
    let run: ScheduledBackupRun;

    try {
      this.logger.log(`[예약 백업] ${target.name}: 시작 (${trigger})`);
      const backup = await this.backupRepository.create(target);
      const { pruned, message } = await this.pruneExpired(target);

      run = {
        target: target.name,
        trigger,
        startedAt,
        finishedAt: new Date().toISOString(),
        success: true,
        message,
        path: backup.path,
        size: backup.size,
        pruned,
      };
      this.logger.log(
        `[예약 백업] ${target.name}: 완료 — ${backup.path} (${backup.size}), 정리 ${pruned.length}개`,
      );
    } catch (error) {
      run = {
        target: target.name,
        trigger,
        startedAt,
        finishedAt: new Date().toISOString(),
        success: false,
        message: `백업 실패: ${toMessage(error)}`,
        path: null,
        size: null,
        pruned: [],
      };
      this.logger.error(`[예약 백업] ${target.name}: ${run.message}`);
    } finally {
      this.running.delete(target.name);
    }

    this.record(run);
    return run;
  }

  /**
   * 새 백업이 성공한 뒤에만 호출한다.
   * 백업이 실패한 날에 옛 백업까지 지우면 복구 수단이 사라지기 때문이다.
   * 정리에 실패해도 방금 만든 백업은 유효하므로 실행 자체는 성공으로 남긴다.
   */
  private async pruneExpired(
    target: ScheduledBackupTarget,
  ): Promise<{ pruned: string[]; message: string }> {
    try {
      const pruned = await this.backupRepository.prune(
        target.name,
        target.retentionDays,
      );
      return {
        pruned,
        message:
          pruned.length > 0
            ? `백업을 완료하고 보관 기간(${target.retentionDays}일)이 지난 백업 ${pruned.length}개를 정리했습니다.`
            : '백업을 완료했습니다.',
      };
    } catch (error) {
      this.logger.warn(
        `[예약 백업] ${target.name}: 오래된 백업 정리 실패 — ${toMessage(error)}`,
      );
      return {
        pruned: [],
        message: `백업은 완료했지만 오래된 백업 정리에 실패했습니다: ${toMessage(error)}`,
      };
    }
  }

  private record(run: ScheduledBackupRun): void {
    try {
      this.runRepository.save(run);
    } catch (error) {
      // 결과 기록에 실패했다고 이미 끝난 백업의 결과를 바꾸지 않는다.
      this.logger.warn(
        `[예약 백업] ${run.target}: 실행 결과 저장 실패 — ${toMessage(error)}`,
      );
    }
  }
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
