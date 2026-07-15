import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  IContainerRepository,
  CONTAINER_REPOSITORY,
} from '../../domain/repositories/container.repository.interface';
import {
  IDockerClient,
  DOCKER_CLIENT,
} from '../../domain/gateways/docker-client.gateway.interface';
import { ResourceConfig } from '../../domain/value-objects/resource-config.vo';
import { ContainerResponseDto, CreateContainerDto } from '../dto';
import { PortForwardingService } from '../services/port-forwarding.service';

/**
 * 컨테이너 생성 유스케이스임.
 * Docker 엔진 생성, 관리 정보 저장, 외부 접속 정보 구성을 하나의 업무 흐름으로 조합함.
 */
@Injectable()
export class CreateContainerUseCase {
  private readonly logger = new Logger(CreateContainerUseCase.name);

  constructor(
    @Inject(CONTAINER_REPOSITORY)
    private readonly containerRepo: IContainerRepository,
    @Inject(DOCKER_CLIENT)
    private readonly dockerClient: IDockerClient,
    private readonly portForwardingService: PortForwardingService,
  ) {}

  async execute(dto: CreateContainerDto): Promise<ContainerResponseDto> {
    // 값 객체에서 CPU·메모리의 유효 범위를 먼저 검증함.
    const resources = ResourceConfig.create(
      dto.resources.cpus,
      dto.resources.memory,
    );

    // 이미지가 로컬에 없으면 Docker 엔진이 내려받도록 요청함.
    await this.dockerClient.pullImage(dto.image);

    // 검증된 입력만 Docker 게이트웨이에 전달해 컨테이너 생성함.
    const dockerId = await this.dockerClient.createContainer({
      name: dto.name,
      image: dto.image,
      ports: dto.ports,
      resources: {
        cpus: resources.cpus,
        memory: resources.memory,
      },
      environment: dto.environment,
    });

    // Docker ID와 소유자를 관리 저장소에 기록해 이후 권한 검증의 기준으로 사용함.
    const container = this.containerRepo.create({
      dockerId,
      name: dto.name,
      image: dto.image,
      status: 'created',
      ports: dto.ports,
      resources: {
        cpus: resources.cpus,
        memory: resources.memory,
      },
      environment: dto.environment,
      userId: dto.userId,
    });

    const savedContainer = await this.containerRepo.save(container);

    /*
     * 라우터 포트 매핑은 외부 장비 상태에 좌우되며 컨테이너 자체의 생성 성공과는
     * 별개임. 매핑 실패가 이미 생성된 컨테이너와 DB 기록을 되돌리면 관리 상태가
     * 더 불안정해지므로 비동기로 시도하고, 실패는 로그로만 남김.
     */
    this.portForwardingService
      .addPortForwardingRules(dto.name, dto.ports)
      .catch((err) =>
        this.logger.error('포트 포워딩 설정에 실패했습니다:', err),
      );

    // 포트 매핑 결과와 무관하게 예측 가능한 외부 접속 주소를 응답에 포함함.
    const externalAccess = this.portForwardingService.getExternalAccess(
      dto.ports,
    );

    // 영속 엔티티를 API 응답 전송 객체로 변환함.
    return ContainerResponseDto.fromEntity(
      savedContainer,
      'created',
      externalAccess,
    );
  }
}
