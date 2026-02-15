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
 * Starts a stopped container
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
    // 1. Find container
    const container = await this.containerRepo.findById(id);
    if (!container) {
      throw new ContainerNotFoundException(id);
    }

    // 2. Start in Docker
    await this.dockerClient.startContainer(container.dockerId);

    // 3. Update status in DB
    await this.containerRepo.updateStatus(id, 'running');
  }
}
