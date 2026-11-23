import { Expose, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { normalizeBoolean } from './docker-request.validation';

/** Docker 정리 실행 HTTP 요청 전송 객체임. */
export class DockerCleanupRequestDto {
  @Expose()
  @IsOptional()
  @Transform(normalizeBoolean)
  @IsBoolean()
  dryRun?: boolean;

  /** 종료된 컨테이너 정리에서 지울 컨테이너 ID. 다른 정리에는 쓰지 않는다. */
  @Expose()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/, { each: true })
  ids?: string[];
}
