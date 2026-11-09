import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSshKeyDto {
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/, {
    message: '키 이름은 영문·숫자·_.- 로 64자 이내여야 합니다.',
  })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsString()
  @MinLength(32)
  @MaxLength(16384)
  privateKey: string;
}
