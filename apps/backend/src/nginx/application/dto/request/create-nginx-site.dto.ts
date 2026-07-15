import { Exclude, Expose, plainToInstance } from 'class-transformer';

/** Nginx 사이트 생성·수정 유스케이스 입력 구조임. */
export interface CreateNginxSiteInput {
  name: string;
  domain: string;
  upstream: string;
  ssl: boolean;
  sslCert?: string;
  sslKey?: string;
  websocket: boolean;
}

/** Nginx 사이트 생성·수정 애플리케이션 요청 전송 객체임. */
@Exclude()
export class CreateNginxSiteDto {
  @Expose()
  name!: string;

  @Expose()
  domain!: string;

  @Expose()
  upstream!: string;

  @Expose()
  ssl!: boolean;

  @Expose()
  sslCert?: string;

  @Expose()
  sslKey?: string;

  @Expose()
  websocket!: boolean;

  /** 표현 계층 입력에서 선언한 필드만 유스케이스 명령으로 복사함. */
  static from(input: CreateNginxSiteInput): CreateNginxSiteDto {
    return plainToInstance(CreateNginxSiteDto, input, {
      excludeExtraneousValues: true,
    });
  }
}
