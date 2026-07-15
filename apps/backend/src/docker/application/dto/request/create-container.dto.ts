import { Exclude, Expose, plainToInstance, Type } from 'class-transformer';

export interface CreateContainerInput {
  name: string;
  image: string;
  ports: Record<string, number>;
  resources: {
    cpus: number;
    memory: string;
  };
  environment?: Record<string, string>;
  userId: string;
}

/**
 * 컨테이너 생성 시 유스케이스가 받는 자원 설정임.
 * HTTP 요청 형식과 분리해 애플리케이션 계층이 표현 계층에 의존하지 않게 함.
 */
@Exclude()
export class ContainerResourceConfigDto {
  @Expose()
  cpus!: number;

  @Expose()
  memory!: string;
}

/**
 * 컨테이너 생성 유스케이스 입력 전송 객체임.
 * from에서 허용 필드만 복사하므로 요청 본문에 섞인 임의 값이 유스케이스까지 전파되지 않음.
 */
@Exclude()
export class CreateContainerDto {
  @Expose()
  name!: string;

  @Expose()
  image!: string;

  @Expose()
  ports!: Record<string, number>;

  @Expose()
  @Type(() => ContainerResourceConfigDto)
  resources!: ContainerResourceConfigDto;

  @Expose()
  environment?: Record<string, string>;

  @Expose()
  userId!: string;

  /**
   * 검증된 요청 값과 인증된 사용자 식별자를 유스케이스 입력으로 조립함.
   * plainToInstance와 excludeExtraneousValues를 함께 써 DTO에 선언하지 않은 값은 제거함.
   */
  static from(input: CreateContainerInput): CreateContainerDto {
    return plainToInstance(
      CreateContainerDto,
      {
        ...input,
        ports: { ...input.ports },
        resources: { ...input.resources },
        environment: input.environment ? { ...input.environment } : undefined,
      },
      { excludeExtraneousValues: true },
    );
  }
}
