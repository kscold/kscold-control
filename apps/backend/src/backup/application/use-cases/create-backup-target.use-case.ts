import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { BackupTarget } from '../../domain/entities/backup-target.entity';
import {
  DEFAULT_BACKUP_SCHEDULE_TIME,
  isValidBackupScheduleTime,
} from '../../domain/policies/backup-schedule.policy';
import {
  DEFAULT_BACKUP_RETENTION_DAYS,
  DEFAULT_MONGODB_DUMP_IMAGE,
  isValidBackupTargetName,
  isValidDumpImage,
  isValidRetentionDays,
  summarizeMongodbUri,
} from '../../domain/policies/backup-target.policy';
import {
  BACKUP_TARGET_REPOSITORY,
  type IBackupTargetRepository,
} from '../../domain/repositories/backup-target.repository';
import { BackupTargetSecretService } from '../services/backup-target-secret.service';
import { assertValidMongodbUri } from '../utils/backup-target-input';

export interface CreateBackupTargetParams {
  name: string;
  description?: string;
  uri: string;
  retentionDays?: number;
  scheduleTime?: string;
  dumpImage?: string;
  enabled?: boolean;
  createdBy: string | null;
}

/** 백업 대상 등록 — 접속 URI 는 암호화해 저장한다 */
@Injectable()
export class CreateBackupTargetUseCase {
  constructor(
    @Inject(BACKUP_TARGET_REPOSITORY)
    private readonly targetRepository: IBackupTargetRepository,
    private readonly secretService: BackupTargetSecretService,
  ) {}

  async execute(params: CreateBackupTargetParams): Promise<BackupTarget> {
    const name = params.name.trim();
    const uri = params.uri.trim();
    const retentionDays = params.retentionDays ?? DEFAULT_BACKUP_RETENTION_DAYS;
    const scheduleTime = params.scheduleTime ?? DEFAULT_BACKUP_SCHEDULE_TIME;
    const dumpImage = params.dumpImage?.trim() || DEFAULT_MONGODB_DUMP_IMAGE;

    if (!isValidBackupTargetName(name)) {
      throw new BadRequestException('백업 대상 이름 형식이 올바르지 않습니다.');
    }
    assertValidMongodbUri(uri);
    if (!isValidRetentionDays(retentionDays)) {
      throw new BadRequestException('보관 기간이 올바르지 않습니다.');
    }
    if (!isValidBackupScheduleTime(scheduleTime)) {
      throw new BadRequestException('실행 시각 형식이 올바르지 않습니다.');
    }
    if (!isValidDumpImage(dumpImage)) {
      throw new BadRequestException('덤프 이미지 형식이 올바르지 않습니다.');
    }
    if (await this.targetRepository.findByName(name)) {
      throw new ConflictException('같은 이름의 백업 대상이 이미 있습니다.');
    }

    return this.targetRepository.create({
      name,
      description: params.description?.trim() ?? '',
      ...this.secretService.seal(name, uri),
      connectionSummary: summarizeMongodbUri(uri),
      dumpImage,
      retentionDays,
      scheduleTime,
      enabled: params.enabled ?? true,
      // 등록한 뒤 처음 돌아오는 예약 시각부터 실행한다.
      scheduleCursorAt: new Date(),
      createdBy: params.createdBy,
    });
  }
}
