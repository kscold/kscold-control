import { Expose, Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { normalizeTrimmedString } from './docker-request.validation';

/** 외부 Docker 컨테이너 가져오기 HTTP 요청 전송 객체임. */
export class ImportContainerRequestDto {
  @Expose()
  @Transform(normalizeTrimmedString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/, {
    message: 'dockerId는 Docker 식별자 또는 컨테이너 이름 형식이어야 함.',
  })
  dockerId!: string;
}
