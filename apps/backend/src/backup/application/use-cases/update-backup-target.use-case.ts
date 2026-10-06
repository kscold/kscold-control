import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { BackupTarget } from '../../domain/entities/backup-target.entity';
import { isValidBackupScheduleTime } from '../../domain/policies/backup-schedule.policy';
import {
  isValidDumpImage,
  isValidRetentionDays,
  summarizeMongodbUri,
} from '../../domain/policies/backup-target.policy';
import {
  BACKUP_TARGET_REPOSITORY,
  type IBackupTargetRepository,
  type UpdateBackupTargetInput,
} from '../../domain/repositories/backup-target.repository';
import { BackupTargetSecretService } from '../services/backup-target-secret.service';
import { assertValidMongodbUri } from '../utils/backup-target-input';

export interface UpdateBackupTargetParams {
  description?: string;
  uri?: string;
  retentionDays?: number;
  scheduleTime?: string;
  dumpImage?: string;
  enabled?: boolean;
}

export interface UpdateBackupTargetResult {
  target: BackupTarget;
  /** 실제로 값이 바뀐 항목 이름. 감사 로그에 남긴다. */
  changedFields: string[];
}

/** 백업 대상 수정 — 보낸 항목만 바꾸고, 일정이 바뀌면 예약 기준 시각을 다시 잡는다 */
@Injectable()
export class UpdateBackupTargetUseCase {
  constructor(
    @Inject(BACKUP_TARGET_REPOSITORY)
    private readonly targetRepository: IBackupTargetRepository,
    private readonly secretService: BackupTargetSecretService,
  ) {}

  async execute(
    id: string,
    params: UpdateBackupTargetParams,
  ): Promise<UpdateBackupTargetResult> {
    const current = await this.targetRepository.findById(id);
    if (!current) {
      throw new NotFoundException('등록되지 않은 백업 대상입니다.');
    }

    const changes: UpdateBackupTargetInput = {};
    const changedFields: string[] = [];

    if (
      params.description !== undefined &&
      params.description.trim() !== current.description
    ) {
      changes.description = params.description.trim();
      changedFields.push('description');
    }

    if (
      params.retentionDays !== undefined &&
      params.retentionDays !== current.retentionDays
    ) {
      if (!isValidRetentionDays(params.retentionDays)) {
        throw new BadRequestException('보관 기간이 올바르지 않습니다.');
      }
      changes.retentionDays = params.retentionDays;
      changedFields.push('retentionDays');
    }

    const dumpImage = params.dumpImage?.trim();
    if (dumpImage && dumpImage !== current.dumpImage) {
      if (!isValidDumpImage(dumpImage)) {
        throw new BadRequestException('덤프 이미지 형식이 올바르지 않습니다.');
      }
      changes.dumpImage = dumpImage;
      changedFields.push('dumpImage');
    }

    if (
      params.scheduleTime !== undefined &&
      params.scheduleTime !== current.scheduleTime
    ) {
      if (!isValidBackupScheduleTime(params.scheduleTime)) {
        throw new BadRequestException('실행 시각 형식이 올바르지 않습니다.');
      }
      changes.scheduleTime = params.scheduleTime;
      changedFields.push('scheduleTime');
    }

    if (params.enabled !== undefined && params.enabled !== current.enabled) {
      changes.enabled = params.enabled;
      changedFields.push('enabled');
    }

    // 저장된 URI 는 읽지 않으므로 값이 같은지 비교하지 않고, 보냈으면 바꾼 것으로 본다.
    const uri = params.uri?.trim();
    if (uri) {
      assertValidMongodbUri(uri);
      Object.assign(changes, this.secretService.seal(current.name, uri));
      changes.connectionSummary = summarizeMongodbUri(uri);
      changedFields.push('uri');
    }

    // 실행 시각을 바꾸거나 다시 켠 직후에는, 이미 지나간 예약 시각을 뒤늦게 실행하지 않는다.
    if (changes.scheduleTime !== undefined || changes.enabled === true) {
      changes.scheduleCursorAt = new Date();
    }

    const target = await this.targetRepository.update(id, changes);
    if (!target) {
      throw new NotFoundException('등록되지 않은 백업 대상입니다.');
    }

    return { target, changedFields };
  }
}
