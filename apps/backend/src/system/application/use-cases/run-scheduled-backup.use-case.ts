import { Injectable } from '@nestjs/common';
import type { ScheduledBackupRun } from '../../domain/types/scheduled-backup.type';
import { ScheduledBackupService } from '../services/scheduled-backup.service';

/** 예약 백업 대상 하나를 일정과 상관없이 지금 백업 */
@Injectable()
export class RunScheduledBackupUseCase {
  constructor(
    private readonly scheduledBackupService: ScheduledBackupService,
  ) {}

  async execute(targetName: string): Promise<ScheduledBackupRun> {
    return this.scheduledBackupService.runTarget(targetName, 'manual');
  }
}
