import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import type { BackupRun } from '../../domain/entities/backup-run.entity';
import type { BackupTarget } from '../../domain/entities/backup-target.entity';
import {
  BACKUP_ARCHIVE_REPOSITORY,
  type IBackupArchiveRepository,
} from '../../domain/repositories/backup-archive.repository';
import {
  BACKUP_RUN_REPOSITORY,
  type FinishBackupRunInput,
  type IBackupRunRepository,
} from '../../domain/repositories/backup-run.repository';
import {
  BACKUP_TARGET_REPOSITORY,
  type IBackupTargetRepository,
} from '../../domain/repositories/backup-target.repository';
import type {
  BackupActor,
  BackupTrigger,
} from '../../domain/types/backup.type';
import { BackupTargetSecretService } from './backup-target-secret.service';

/** 서버가 내려가 끝맺지 못한 실행에 남기는 문구 */
const INTERRUPTED_RUN_MESSAGE =
  '서버가 다시 시작되어 백업이 중단됐습니다. 필요하면 다시 실행하세요.';

/** 백업 한 번의 실행 순서(덤프 → 보관 기간 정리 → 결과 기록)를 맡는다. */
@Injectable()
export class BackupRunnerService implements OnModuleInit {
  private readonly logger = new Logger(BackupRunnerService.name);

  /** 같은 대상의 백업이 겹쳐 돌지 않게 막는 실행 중 표시 (대상 id) */
  private readonly running = new Set<string>();

  constructor(
    @Inject(BACKUP_TARGET_REPOSITORY)
    private readonly targetRepository: IBackupTargetRepository,
    @Inject(BACKUP_RUN_REPOSITORY)
    private readonly runRepository: IBackupRunRepository,
    @Inject(BACKUP_ARCHIVE_REPOSITORY)
    private readonly archiveRepository: IBackupArchiveRepository,
    private readonly secretService: BackupTargetSecretService,
  ) {}

  /**
   * 덤프 도중 서버가 내려가면 실행 기록이 "실행 중"으로 남는다.
   * 그대로 두면 화면에서 영원히 도는 것처럼 보이므로 기동할 때 실패로 닫는다.
   */
  async onModuleInit(): Promise<void> {
    try {
      const closed = await this.runRepository.failUnfinished(
        INTERRUPTED_RUN_MESSAGE,
      );
      if (closed > 0) {
        this.logger.warn(`[백업] 중단된 실행 기록 ${closed}건을 실패로 닫음`);
      }
    } catch (error) {
      // 이력 정리에 실패했다고 관리 콘솔 전체가 뜨지 못하면 안 된다.
      this.logger.error(
        `[백업] 중단된 실행 기록 정리 실패: ${toMessage(error)}`,
      );
    }
  }

  isRunning(targetId: string): boolean {
    return this.running.has(targetId);
  }

  /**
   * 백업을 시작하고 실행 기록만 먼저 돌려준다. 덤프는 뒤에서 이어진다.
   * 덤프가 길어져도 요청이 시간 제한에 걸리지 않게 하기 위함이다.
   */
  async start(
    targetId: string,
    trigger: BackupTrigger,
    actor: BackupActor | null = null,
  ): Promise<BackupRun> {
    const { run } = await this.begin(targetId, trigger, actor);
    return run;
  }

  /** 백업을 시작하고 끝날 때까지 기다린 뒤 결과를 돌려준다. */
  async runToCompletion(
    targetId: string,
    trigger: BackupTrigger,
  ): Promise<BackupRun> {
    const { completion } = await this.begin(targetId, trigger, null);
    return completion;
  }

  private async begin(
    targetId: string,
    trigger: BackupTrigger,
    actor: BackupActor | null,
  ): Promise<{ run: BackupRun; completion: Promise<BackupRun> }> {
    const target = await this.targetRepository.findByIdWithSecret(targetId);
    if (!target) {
      throw new NotFoundException('등록되지 않은 백업 대상입니다.');
    }
    if (this.running.has(target.id)) {
      throw new ConflictException('이미 백업이 진행 중입니다.');
    }

    this.running.add(target.id);
    let run: BackupRun;
    try {
      run = await this.runRepository.start({
        targetId: target.id,
        trigger,
        actor,
      });
    } catch (error) {
      this.running.delete(target.id);
      throw error;
    }

    this.logger.log(`[백업] ${target.name}: 시작 (${trigger})`);
    // execute 는 실패도 결과로 돌려주므로 거부되지 않는다.
    const completion = this.execute(target, run).finally(() =>
      this.running.delete(target.id),
    );

    return { run, completion };
  }

  private async execute(
    target: BackupTarget,
    run: BackupRun,
  ): Promise<BackupRun> {
    let outcome: FinishBackupRunInput;

    try {
      const archive = await this.archiveRepository.create({
        name: target.name,
        uri: this.secretService.open(target),
        image: target.dumpImage,
      });
      const { pruned, message } = await this.pruneExpired(target);

      outcome = {
        status: 'success',
        message,
        archivePath: archive.path,
        archiveSizeBytes: archive.sizeBytes,
        pruned,
      };
      this.logger.log(
        `[백업] ${target.name}: 완료 — ${archive.path} (${archive.sizeBytes} bytes), 정리 ${pruned.length}개`,
      );
    } catch (error) {
      outcome = {
        status: 'failed',
        message: `백업 실패: ${toMessage(error)}`,
        archivePath: null,
        archiveSizeBytes: null,
        pruned: [],
      };
      this.logger.error(`[백업] ${target.name}: ${outcome.message}`);
    }

    try {
      return await this.runRepository.finish(run.id, outcome);
    } catch (error) {
      // 결과 기록에 실패했다고 이미 끝난 백업의 결과를 바꾸지 않는다.
      this.logger.warn(
        `[백업] ${target.name}: 실행 결과 저장 실패 — ${toMessage(error)}`,
      );
      return { ...run, ...outcome, finishedAt: new Date() };
    }
  }

  /**
   * 새 백업이 성공한 뒤에만 호출한다.
   * 백업이 실패한 날에 옛 백업까지 지우면 복구 수단이 사라지기 때문이다.
   * 정리에 실패해도 방금 만든 백업은 유효하므로 실행 자체는 성공으로 남긴다.
   */
  private async pruneExpired(
    target: BackupTarget,
  ): Promise<{ pruned: string[]; message: string }> {
    try {
      const pruned = await this.archiveRepository.prune(
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
        `[백업] ${target.name}: 오래된 백업 정리 실패 — ${toMessage(error)}`,
      );
      return {
        pruned: [],
        message: `백업은 완료했지만 오래된 백업 정리에 실패했습니다: ${toMessage(error)}`,
      };
    }
  }
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
