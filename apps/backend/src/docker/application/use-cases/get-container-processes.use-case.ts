import { Inject, Injectable } from '@nestjs/common';
import { ContainerNotFoundException } from '../../../common/exceptions';
import {
  CONTAINER_REPOSITORY,
  type IContainerRepository,
} from '../../domain/repositories/container.repository.interface';
import {
  DOCKER_CLIENT,
  type DockerContainerProcesses,
  type IDockerClient,
} from '../../domain/gateways/docker-client.gateway.interface';

/**
 * 컨테이너 내부 프로세스 조회함.
 *
 * 일반 사용자는 자신이 관리하는 컨테이너만 읽을 수 있고, 전역 관리자는
 * Docker ID로 외부 컨테이너도 조회할 수 있음. 이 권한 범위 판단을
 * 표현 계층에서 분리해 HTTP 외 호출 경로도 같은 규칙을 따르게 함.
 */
@Injectable()
export class GetContainerProcessesUseCase {
  constructor(
    @Inject(CONTAINER_REPOSITORY)
    private readonly containerRepository: IContainerRepository,
    @Inject(DOCKER_CLIENT) private readonly dockerClient: IDockerClient,
  ) {}

  async execute(
    dockerId: string,
    ownerId?: string,
  ): Promise<DockerContainerProcesses> {
    if (ownerId) {
      const container = await this.containerRepository.findByDockerId(dockerId);

      if (!container || container.userId !== ownerId) {
        throw new ContainerNotFoundException(dockerId);
      }
    }

    return this.dockerClient.getContainerProcesses(dockerId);
  }
}
