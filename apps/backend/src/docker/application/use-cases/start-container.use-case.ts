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

  async execute(id: string): Promise<void> {
    // 1. Try to find in DB by UUID
    const container = await this.containerRepo.findById(id);

    if (container) {
      // Managed container: start via dockerId and update DB
      await this.dockerClient.startContainer(container.dockerId);
      await this.containerRepo.updateStatus(id, 'running');
      return;
    }

    // 2. Fallback: treat id as dockerId for external containers
    try {
      await this.dockerClient.startContainer(id);
    } catch {
      throw new ContainerNotFoundException(id);
    }
  }
}
