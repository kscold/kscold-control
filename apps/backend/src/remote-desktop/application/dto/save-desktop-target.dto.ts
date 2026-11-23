import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class SaveDesktopTargetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  port: number;

  @IsString()
  @MaxLength(255)
  username: string;

  @IsString()
  @MaxLength(1024)
  password: string;

  @IsBoolean()
  saveCredentials: boolean;

  // 같은 망의 사설 IPv4. 비우면 서버 자신(127.0.0.1)으로 연결함.
  @IsOptional()
  @IsString()
  @MaxLength(15)
  host?: string;

  @IsOptional()
  @IsIn(['vnc', 'rdp'])
  protocol?: 'vnc' | 'rdp';

  @IsOptional()
  @IsString()
  @MaxLength(17)
  wakeMac?: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  wakeBroadcast?: string;
}
