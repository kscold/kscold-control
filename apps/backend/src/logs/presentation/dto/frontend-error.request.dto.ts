import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** POST /logs/frontend-error 요청 본문 */
export class FrontendErrorRequestDto {
  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsOptional()
  @IsString()
  stack?: string;

  @IsOptional()
  @IsString()
  componentStack?: string;

  @IsOptional()
  @IsString()
  url?: string;
}
