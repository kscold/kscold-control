import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  IContainerRepository,
  CONTAINER_REPOSITORY,
} from '../../domain/repositories/container.repository.interface';
import {
  IDockerClient,
  DOCKER_CLIENT,
} from '../../domain/gateways/docker-client.gateway.interface';
import { ContainerNotFoundException } from '../../../common/exceptions';
import { PortForwardingService } from '../services/port-forwarding.service';

/**
 * 컨테이너 제거 유스케이스임.
 * Docker 엔진, 라우터 포트 매핑, 관리 저장소를 순서대로 정리함.
 */
@Injectable()
export class RemoveContainerUseCase {
  private readonly logger = new Logger(RemoveContainerUseCase.name);

  constructor(
    @Inject(CONTAINER_REPOSITORY)
    private readonly containerRepo: IContainerRepository,
    @Inject(DOCKER_CLIENT)
    private readonly dockerClient: IDockerClient,
    private readonly portForwardingService: PortForwardingService,
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
      try {
        await this.dockerClient.removeContainer(container.dockerId);
      } catch (error) {
        this.logger.error(
          `Docker 컨테이너 제거에 실패했습니다: ${container.dockerId}`,
          error,
        );
      }

      try {
        await this.portForwardingService.removePortForwardingRules(
          container.name,
        );
      } catch (error) {
        this.logger.error(
          `포트 포워딩 제거에 실패했습니다: ${container.name}`,
          error,
        );
      }

      await this.containerRepo.delete(container.id);
      return;
    }

    if (ownerId) {
      throw new ContainerNotFoundException(id);
    }

    // 전역 관리자는 관리 DB에 없는 외부 컨테이너도 Docker ID로 직접 제어할 수 있음.
    try {
      await this.dockerClient.removeContainer(id);
    } catch {
      throw new ContainerNotFoundException(id);
    }
  }
}
