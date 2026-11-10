import {
  IsBoolean,
  IsInt,
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
}
