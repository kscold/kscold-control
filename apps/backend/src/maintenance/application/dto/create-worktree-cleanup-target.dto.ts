import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DAILY_SCHEDULE_TIME_PATTERN } from '../../../common/scheduling/daily-schedule.policy';
import {
  BASE_REF_PATTERN,
  CLEANUP_TARGET_NAME_PATTERN,
  MAX_BASE_REFS,
  MAX_ROOT_PATH_LENGTH,
} from '../../domain/policies/worktree-cleanup-target.policy';
import { MAX_KEEP_RECENT } from '../../domain/policies/worktree-retention.policy';

export class CreateWorktreeCleanupTargetDto {
  @IsString()
  @Matches(CLEANUP_TARGET_NAME_PATTERN, {
    message:
      '이름은 영문·숫자로 시작하고 영문·숫자·점·밑줄·하이픈만 64자까지 쓸 수 있습니다.',
  })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsString()
  @MaxLength(MAX_ROOT_PATH_LENGTH)
  rootPath: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_KEEP_RECENT)
  keepRecent?: number;

  @IsOptional()
  @IsBoolean()
  protectUnmerged?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_BASE_REFS)
  @ArrayUnique()
  @Matches(BASE_REF_PATTERN, {
    each: true,
    message: '기준 브랜치 형식이 올바르지 않습니다.',
  })
  baseRefs?: string[];

  @IsOptional()
  @IsString()
  @Matches(DAILY_SCHEDULE_TIME_PATTERN, {
    message: '실행 시각은 HH:mm 형식이어야 합니다.',
  })
  scheduleTime?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
