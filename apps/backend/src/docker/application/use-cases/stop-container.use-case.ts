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

  async execute(id: string): Promise<void> {
    // 1. Try to find in DB by UUID
    const container = await this.containerRepo.findById(id);

    if (container) {
      // Managed container: stop via dockerId and update DB
      await this.dockerClient.stopContainer(container.dockerId);
      await this.containerRepo.updateStatus(id, 'stopped');
      return;
    }

    // 2. Fallback: treat id as dockerId for external containers
    try {
      await this.dockerClient.stopContainer(id);
    } catch {
      throw new ContainerNotFoundException(id);
    }
  }
}
