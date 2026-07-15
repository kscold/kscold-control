import {
  Expose,
  Transform,
  Type,
  type TransformFnParams,
} from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

function normalizeTrimmedString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeProtocol({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

/** UPnP 포트 매핑 추가 HTTP 요청 전송 객체임. */
export class CreateMappingRequestDto {
  @Expose()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65_535)
  publicPort!: number;

  @Expose()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65_535)
  privatePort!: number;

  @Expose()
  @IsOptional()
  @Transform(normalizeProtocol)
  @IsIn(['TCP', 'UDP'])
  protocol?: 'TCP' | 'UDP';

  @Expose()
  @IsOptional()
  @Transform(normalizeTrimmedString)
  @IsString()
  description?: string;
}
