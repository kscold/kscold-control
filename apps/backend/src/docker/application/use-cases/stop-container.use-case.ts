import { Injectable, Inject } from '@nestjs/common';
import {
  IContainerRepository,
  CONTAINER_REPOSITORY,
} from '../../domain/repositories/container.repository.interface';
import {
  IDockerClient,
  DOCKER_CLIENT,
} from '../../domain/gateways/docker-client.gateway.interface';
import { ContainerNotFoundException } from '../../../common/exceptions';

/**
 * 컨테이너 중지 유스케이스임.
 * 사용자 소유 관리 컨테이너와 전역 관리자의 외부 컨테이너 제어를 함께 처리함.
 */
@Injectable()
export class StopContainerUseCase {
  constructor(
    @Inject(CONTAINER_REPOSITORY)
    private readonly containerRepo: IContainerRepository,
    @Inject(DOCKER_CLIENT)
    private readonly dockerClient: IDockerClient,
  ) {}

  async execute(id: string, ownerId?: string): Promise<void> {
    // 화면은 DB UUID 또는 Docker ID를 보낼 수 있으므로 둘 다 관리 대상에서 찾습니다.
    const container =
      (await this.containerRepo.findById(id)) ??
      (await this.containerRepo.findByDockerId(id));

    if (ownerId && container?.userId !== ownerId) {
      throw new ContainerNotFoundException(id);
    }

    if (container) {
      await this.dockerClient.stopContainer(container.dockerId);
      await this.containerRepo.updateStatus(container.id, 'stopped');
      return;
    }

    if (ownerId) {
      throw new ContainerNotFoundException(id);
    }

    // 전역 관리자는 관리 DB에 없는 외부 컨테이너도 Docker ID로 직접 제어할 수 있음.
    try {
      await this.dockerClient.stopContainer(id);
    } catch {
      throw new ContainerNotFoundException(id);
    }
  }
}
