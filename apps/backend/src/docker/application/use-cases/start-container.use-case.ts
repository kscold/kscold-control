import { Injectable, Inject } from '@nestjs/common';
import {
  IContainerRepository,
  CONTAINER_REPOSITORY,
} from '../../domain/repositories/container.repository.interface';
import {
  IDockerClient,
  DOCKER_CLIENT,
} from '../../domain/repositories/docker-client.interface';
import { ContainerNotFoundException } from '../../../common/exceptions';

/**
 * Start Container Use Case
 * Starts a stopped container (supports both managed and external)
 */
@Injectable()
export class StartContainerUseCase {
  constructor(
    @Inject(CONTAINER_REPOSITORY)
    private readonly containerRepo: IContainerRepository,
    @Inject(DOCKER_CLIENT)
    private readonly dockerClient: IDockerClient,
  ) {}

  async execute(id: string, ownerId?: string): Promise<void> {
    // 1. Resolve managed containers by either DB UUID or Docker ID.
    const container =
      (await this.containerRepo.findById(id)) ??
      (await this.containerRepo.findByDockerId(id));

    if (ownerId && container?.userId !== ownerId) {
      throw new ContainerNotFoundException(id);
    }

    if (container) {
      await this.dockerClient.startContainer(container.dockerId);
      await this.containerRepo.updateStatus(container.id, 'running');
      return;
    }

    if (ownerId) {
      throw new ContainerNotFoundException(id);
    }

    // Super admins may operate unmanaged external containers by Docker ID.
    try {
      await this.dockerClient.startContainer(id);
    } catch {
      throw new ContainerNotFoundException(id);
    }
  }
}
