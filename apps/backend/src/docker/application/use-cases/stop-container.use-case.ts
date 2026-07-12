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
 * Stop Container Use Case
 * Stops a running container (supports both managed and external)
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
    // 1. Resolve managed containers by either DB UUID or Docker ID.
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

    // Super admins may operate unmanaged external containers by Docker ID.
    try {
      await this.dockerClient.stopContainer(id);
    } catch {
      throw new ContainerNotFoundException(id);
    }
  }
}
