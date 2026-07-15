import { Exclude, Expose, plainToInstance } from 'class-transformer';

/** Compose 서비스 생성 화면에 제공하는 기본값 원본 구조임. */
export interface ComposeProvisioningTemplateValues {
  name: string;
  image: string;
  cpus: string;
  memLimit: string;
  command: string;
  ports: Record<string, number>;
}

/** Compose 서비스 생성 기본값 응답 전송 객체임. */
@Exclude()
export class ComposeProvisioningTemplateResponseDto {
  @Expose()
  name!: string;

  @Expose()
  image!: string;

  @Expose()
  cpus!: string;

  @Expose()
  memLimit!: string;

  @Expose()
  command!: string;

  @Expose()
  ports!: Record<string, number>;

  /** 허용한 기본값 필드만 API 응답 객체로 변환함. */
  static from(
    values: ComposeProvisioningTemplateValues,
  ): ComposeProvisioningTemplateResponseDto {
    return plainToInstance(
      ComposeProvisioningTemplateResponseDto,
      {
        ...values,
        ports: { ...values.ports },
      },
      { excludeExtraneousValues: true },
    );
  }
}
