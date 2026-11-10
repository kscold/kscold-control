import { IsIP, IsOptional, IsString, MaxLength } from 'class-validator';

export class SshIpDto {
  @IsIP()
  ip: string;
}

export class SshBlockDto {
  @IsIP()
  ip: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
