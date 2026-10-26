import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** POST /logs/frontend-error 요청 본문 */
export class FrontendErrorRequestDto {
  @IsString()
  @IsOptional()
  @MaxLength(4096)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16384)
  stack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16384)
  componentStack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  kind?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  route?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  errorType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  stage?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  batchIndex?: number;

  @IsOptional()
  @IsInt()
  @Min(400)
  @Max(599)
  httpStatus?: number;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  release?: string;
}
