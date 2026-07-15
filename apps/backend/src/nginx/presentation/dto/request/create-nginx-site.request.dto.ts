import { Expose, Transform, type TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

function normalizeTrimmedString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeBoolean({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  if (value.toLowerCase() === 'true') {
    return true;
  }

  if (value.toLowerCase() === 'false') {
    return false;
  }

  return value;
}

/** Nginx 사이트 생성·수정 HTTP 요청 전송 객체임. */
export class CreateNginxSiteRequestDto {
  @Expose()
  @Transform(normalizeTrimmedString)
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/, {
    message: 'name은 영문·숫자·점·밑줄·하이픈만 허용함.',
  })
  name!: string;

  @Expose()
  @Transform(normalizeTrimmedString)
  @IsString()
  @IsNotEmpty()
  domain!: string;

  @Expose()
  @Transform(normalizeTrimmedString)
  @IsString()
  @IsNotEmpty()
  upstream!: string;

  @Expose()
  @Transform(normalizeBoolean)
  @IsBoolean()
  ssl!: boolean;

  @Expose()
  @IsOptional()
  @Transform(normalizeTrimmedString)
  @IsString()
  sslCert?: string;

  @Expose()
  @IsOptional()
  @Transform(normalizeTrimmedString)
  @IsString()
  sslKey?: string;

  @Expose()
  @Transform(normalizeBoolean)
  @IsBoolean()
  websocket!: boolean;
}
