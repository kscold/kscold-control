import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  DUMP_IMAGE_PATTERN,
  MAX_BACKUP_DESCRIPTION_LENGTH,
  MAX_BACKUP_RETENTION_DAYS,
  MAX_MONGODB_URI_LENGTH,
  MONGODB_URI_PATTERN,
} from '../../domain/policies/backup-target.policy';
import { BACKUP_SCHEDULE_TIME_PATTERN } from '../../domain/policies/backup-schedule.policy';

/**
 * 백업 대상 수정 요청. 보낸 항목만 바꾼다.
 * 이름은 백업 디렉터리 이름으로 쓰여 바꿀 수 없으므로 받지 않는다.
 */
export class UpdateBackupTargetDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_BACKUP_DESCRIPTION_LENGTH)
  description?: string;

  /** 비워 두면 저장된 접속 정보를 그대로 쓴다. */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_MONGODB_URI_LENGTH)
  @Matches(MONGODB_URI_PATTERN, {
    message:
      '접속 URI 는 mongodb:// 또는 mongodb+srv:// 로 시작하고 공백·따옴표·역슬래시가 없어야 합니다.',
  })
  uri?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_BACKUP_RETENTION_DAYS)
  retentionDays?: number;

  @IsOptional()
  @IsString()
  @Matches(BACKUP_SCHEDULE_TIME_PATTERN, {
    message: '실행 시각은 HH:mm 형식이어야 합니다.',
  })
  scheduleTime?: string;

  @IsOptional()
  @IsString()
  @Matches(DUMP_IMAGE_PATTERN, {
    message: '덤프 이미지 형식이 올바르지 않습니다.',
  })
  dumpImage?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
