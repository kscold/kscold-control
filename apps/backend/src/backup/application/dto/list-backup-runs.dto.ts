import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/** 한 번에 조회할 수 있는 실행 이력 최대 건수 */
export const MAX_BACKUP_RUN_LIMIT = 100;

export class ListBackupRunsDto {
  /** 지정하면 그 대상의 이력만 조회한다. */
  @IsOptional()
  @IsUUID()
  targetId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_BACKUP_RUN_LIMIT)
  limit?: number;
}
