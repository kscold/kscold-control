import { Injectable } from '@nestjs/common';
import type { BackupRun } from '../../domain/entities/backup-run.entity';
import type { BackupActor } from '../../domain/types/backup.type';
import { BackupRunnerService } from '../services/backup-runner.service';

/** 백업 대상 하나를 일정과 상관없이 지금 백업 — 시작만 하고 실행 기록을 돌려준다 */
@Injectable()
export class RunBackupTargetUseCase {
  constructor(private readonly runner: BackupRunnerService) {}

  execute(targetId: string, actor: BackupActor): Promise<BackupRun> {
    return this.runner.start(targetId, 'manual', actor);
  }
}
