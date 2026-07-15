import { Exclude, Expose, plainToInstance, Type } from 'class-transformer';
import { Container } from '../../../domain/entities/container.entity';

export interface DockerContainerResponseSource {
  id: string;
  name?: string;
  image?: string;
  state: string;
  created: number;
}

export interface ContainerExternalAccess {
  ssh?: string;
  http?: string;
  domain: string;
}

/** 컨테이너 응답의 자원 정보임. */
@Exclude()
export class ContainerResourceResponseDto {
  @Expose()
  cpus!: number;

  @Expose()
  memory!: string;
}

/** 컨테이너 응답의 외부 접속 정보임. */
@Exclude()
export class ContainerExternalAccessResponseDto {
  @Expose()
  ssh?: string;

  @Expose()
  http?: string;

  @Expose()
  domain!: string;
}

/**
 * 컨테이너 유스케이스 응답 전송 객체임.
 * from 계열 팩터리는 명시적으로 노출한 값만 직렬화해 영속 엔티티 내부 필드가 응답에 섞이지 않게 함.
 */
@Exclude()
export class ContainerResponseDto {
  @Expose()
  id!: string;

  @Expose()
  dockerId!: string;

  @Expose()
  name!: string;

  @Expose()
  image!: string;

  @Expose()
  status!: string;

  @Expose()
  liveStatus?: string;

  @Expose()
  ports!: Record<string, number>;

  @Expose()
  @Type(() => ContainerResourceResponseDto)
  resources!: ContainerResourceResponseDto;

  @Expose()
  createdAt!: string;

  @Expose()
  @Type(() => ContainerExternalAccessResponseDto)
  externalAccess?: ContainerExternalAccessResponseDto;

  @Expose()
  isManaged!: boolean;

  @Expose()
  isComposeManaged!: boolean;

  /** 관리 대상 엔티티를 응답 구조로 변환함. */
  static fromEntity(
    container: Container,
    liveStatus?: string,
    externalAccess?: ContainerExternalAccess,
    isComposeManaged: boolean = false,
  ): ContainerResponseDto {
    return ContainerResponseDto.from({
      id: container.id,
      dockerId: container.dockerId,
      name: container.name,
      image: container.image,
      status: container.status,
      liveStatus,
      ports: { ...container.ports },
      resources: {
        cpus: container.resources.cpus,
        memory: container.resources.memory,
      },
      createdAt: container.createdAt.toISOString(),
      externalAccess,
      isManaged: true,
      isComposeManaged,
    });
  }

  /**
   * DB에 등록되지 않은 Docker 컨테이너를 응답 구조로 변환함.
   * 외부 컨테이너는 관리 UUID가 없으므로 Docker ID를 식별자로 사용함.
   */
  static fromDockerContainer(
    dockerContainer: DockerContainerResponseSource,
    ports: Record<string, number>,
    resources: ContainerResourceResponseDto,
    externalAccess?: ContainerExternalAccess,
    isComposeManaged: boolean = false,
  ): ContainerResponseDto {
    return ContainerResponseDto.from({
      id: dockerContainer.id,
      dockerId: dockerContainer.id,
      name: dockerContainer.name || 'Unknown',
      image: dockerContainer.image || 'Unknown',
      status: dockerContainer.state,
      liveStatus: dockerContainer.state,
      ports: { ...ports },
      resources,
      createdAt: new Date(dockerContainer.created * 1000).toISOString(),
      externalAccess,
      isManaged: false,
      isComposeManaged,
    });
  }

  /** 관리 대상 엔티티 목록을 응답 목록으로 변환함. */
  static fromEntities(
    containers: Array<{
      container: Container;
      liveStatus?: string;
      externalAccess?: ContainerExternalAccess;
      isComposeManaged?: boolean;
    }>,
  ): ContainerResponseDto[] {
    return containers.map(
      ({ container, liveStatus, externalAccess, isComposeManaged }) =>
        ContainerResponseDto.fromEntity(
          container,
          liveStatus,
          externalAccess,
          isComposeManaged,
        ),
    );
  }

  private static from(data: object): ContainerResponseDto {
    return plainToInstance(ContainerResponseDto, data, {
      excludeExtraneousValues: true,
    });
  }
}
