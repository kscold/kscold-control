import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import type { CreateNginxSiteDto } from '../../domain/types/nginx-site.type';

/** POST/PUT /nginx/sites 요청 본문 — 런타임 검증 포함 */
export class CreateNginxSiteRequestDto implements CreateNginxSiteDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/, {
    message: 'name은 영문/숫자/._- 만 허용합니다.',
  })
  name!: string;

  @IsString()
  @IsNotEmpty()
  domain!: string;

  @IsString()
  @IsNotEmpty()
  upstream!: string;

  @IsBoolean()
  ssl!: boolean;

  @IsOptional()
  @IsString()
  sslCert?: string;

  @IsOptional()
  @IsString()
  sslKey?: string;

  @IsBoolean()
  websocket!: boolean;
}
