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
  BACKUP_TARGET_NAME_PATTERN,
  DUMP_IMAGE_PATTERN,
  MAX_BACKUP_DESCRIPTION_LENGTH,
  MAX_BACKUP_RETENTION_DAYS,
  MAX_MONGODB_URI_LENGTH,
  MONGODB_URI_PATTERN,
} from '../../domain/policies/backup-target.policy';
import { BACKUP_SCHEDULE_TIME_PATTERN } from '../../domain/policies/backup-schedule.policy';

export class CreateBackupTargetDto {
  @IsString()
  @Matches(BACKUP_TARGET_NAME_PATTERN, {
    message:
      '이름은 영문·숫자로 시작하고 영문·숫자·점·밑줄·하이픈만 64자까지 쓸 수 있습니다.',
  })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_BACKUP_DESCRIPTION_LENGTH)
  description?: string;

  @IsString()
  @MaxLength(MAX_MONGODB_URI_LENGTH)
  @Matches(MONGODB_URI_PATTERN, {
    message:
      '접속 URI 는 mongodb:// 또는 mongodb+srv:// 로 시작하고 공백·따옴표·역슬래시가 없어야 합니다.',
  })
  uri: string;

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
