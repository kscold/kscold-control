import { Expose, Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { normalizeBoolean } from './docker-request.validation';

/** Docker 정리 실행 HTTP 요청 전송 객체임. */
export class DockerCleanupRequestDto {
  @Expose()
  @IsOptional()
  @Transform(normalizeBoolean)
  @IsBoolean()
  dryRun?: boolean;
}
