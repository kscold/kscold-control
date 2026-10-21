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
  MAX_BASE_REFS,
} from '../../domain/policies/worktree-cleanup-target.policy';
import { MAX_KEEP_RECENT } from '../../domain/policies/worktree-retention.policy';

/** 보낸 항목만 바꾼다. 이름과 정리 루트는 바꿀 수 없다. */
export class UpdateWorktreeCleanupTargetDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

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
