import { Inject, Injectable } from '@nestjs/common';
import { ContainerNotFoundException } from '../../../common/exceptions';
import {
  CONTAINER_REPOSITORY,
  type IContainerRepository,
} from '../../domain/repositories/container.repository.interface';
import {
  DOCKER_CLIENT,
  type IDockerClient,
} from '../../domain/gateways/docker-client.gateway.interface';

/**
 * 컨테이너 재시작. 해외에서 폰으로 멈춘 서비스를 되살리는 가장 흔한 조치라
 * 가져오기(Import) 하지 않은 외부 컨테이너도 Docker ID 로 다시 켤 수 있게 한다.
 * 권한 범위는 로그·프로세스 조회와 같다: 일반 사용자는 자기 컨테이너만.
 */
@Injectable()
export class RestartContainerUseCase {
  constructor(
    @Inject(CONTAINER_REPOSITORY)
    private readonly containerRepository: IContainerRepository,
    @Inject(DOCKER_CLIENT) private readonly dockerClient: IDockerClient,
  ) {}

  async execute(dockerId: string, ownerId?: string): Promise<void> {
    if (ownerId) {
      const container = await this.containerRepository.findByDockerId(dockerId);
      if (!container || container.userId !== ownerId) {
        throw new ContainerNotFoundException(dockerId);
      }
    }
    await this.dockerClient.restartContainer(dockerId);
  }
}
