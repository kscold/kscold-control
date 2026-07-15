import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Expose, Transform, Type } from 'class-transformer';
import {
  IsEnvironmentMap,
  IsPortMap,
  normalizeEnvironment,
  normalizePortMap,
  normalizeTrimmedString,
} from './docker-request.validation';

/** 컨테이너 자원 설정 HTTP 요청 전송 객체임. */
export class ContainerResourceRequestDto {
  @Expose()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(16)
  cpus!: number;

  @Expose()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Matches(/^\d+[bkmg]$/i, {
    message: 'memory는 128m 또는 4g처럼 숫자와 단위를 함께 입력해야 함.',
  })
  memory!: string;
}

/**
 * 컨테이너 생성 HTTP 요청 전송 객체임.
 * @Transform으로 문자열·숫자 입력을 정규화한 뒤 class-validator가 형식과 범위를 검증함.
 */
export class CreateContainerRequestDto {
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
  @ValidateNested()
  @Type(() => ContainerResourceRequestDto)
  resources!: ContainerResourceRequestDto;

  @Expose()
  @IsOptional()
  @Transform(normalizeEnvironment)
  @IsEnvironmentMap()
  environment?: Record<string, string>;
}
