import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsIP,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class SshIpDto {
  @IsIP()
  ip: string;

  /** 내 IP 별칭 (회사·집 등) */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;
}

export class SshKnownLabelDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;
}

export class SshBlockDto {
  @IsIP()
  ip: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;

  /** all: 모든 접속(SSH·운영 사이트), ssh: SSH 만. 기본 all */
  @IsOptional()
  @IsIn(['all', 'ssh'])
  scope?: 'all' | 'ssh';
}

export class SshBlockScopeDto {
  @IsIn(['all', 'ssh'])
  scope: 'all' | 'ssh';
}

export class SshCountryGuardDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /** ISO 3166-1 두 글자 국가 코드 */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(250)
  @Matches(/^[A-Za-z]{2}$/, { each: true })
  allowedCountries?: string[];
}
