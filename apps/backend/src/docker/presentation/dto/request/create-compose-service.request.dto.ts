import { Expose, Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  IsPortMap,
  normalizePortMap,
  normalizeTrimmedString,
} from './docker-request.validation';

/** Compose 서비스 생성 HTTP 요청 전송 객체임. */
export class CreateComposeServiceRequestDto {
  @Expose()
  @Transform(normalizeTrimmedString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(63)
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}$/, {
    message:
      'name은 영문 또는 숫자로 시작하고 영문, 숫자, 점, 밑줄, 하이픈만 사용할 수 있음.',
  })
  name!: string;

  @Expose()
  @Transform(normalizeTrimmedString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  image!: string;

  @Expose()
  @Transform(normalizePortMap)
  @IsPortMap()
  ports!: Record<string, number>;

  @Expose()
  @Transform(normalizeTrimmedString)
  @Matches(/^(?:0?\.[1-9]\d*|[1-9]\d*(?:\.\d+)?)$/, {
    message: 'cpus는 2 또는 1.5처럼 0보다 큰 숫자 문자열이어야 함.',
  })
  cpus!: string;

  @Expose()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @Matches(/^\d+[bkmg]$/i, {
    message: 'memLimit은 512m 또는 4g처럼 숫자와 단위를 함께 입력해야 함.',
  })
  memLimit!: string;

  @Expose()
  @IsOptional()
  @Transform(normalizeTrimmedString)
  @IsString()
  @MaxLength(1_024)
  command?: string;
}
