import { IsIn, IsIP, IsOptional, IsString, MaxLength } from 'class-validator';

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
