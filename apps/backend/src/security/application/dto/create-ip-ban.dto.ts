import {
  IsIP,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateIpBanDto {
  @IsIP()
  ip: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  /**
   * 만료까지 남은 분. null 또는 0 → 영구 차단.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  ttlMinutes?: number;
}
