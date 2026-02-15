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
import { PortForwardingService } from '../services/port-forwarding.service';

/**
 * Remove Container Use Case
 * Removes a container from Docker and database
 */
@Injectable()
export class RemoveContainerUseCase {
  constructor(
    @Inject(CONTAINER_REPOSITORY)
    private readonly containerRepo: IContainerRepository,
    @Inject(DOCKER_CLIENT)
    private readonly dockerClient: IDockerClient,
    private readonly portForwardingService: PortForwardingService,
  ) {}

  async execute(id: string): Promise<void> {
    // 1. Find container
    const container = await this.containerRepo.findById(id);
    if (!container) {
      throw new ContainerNotFoundException(id);
    }

    // 2. Remove from Docker
    try {
      await this.dockerClient.removeContainer(container.dockerId);
    } catch (error) {
      console.error(
        `Failed to remove Docker container ${container.dockerId}:`,
        error,
      );
      // Continue with DB deletion even if Docker removal fails
    }

    // 3. Remove port forwarding rules
    try {
      await this.portForwardingService.removePortForwardingRules(
        container.name,
      );
    } catch (error) {
      console.error(
        `Failed to remove port forwarding for ${container.name}:`,
        error,
      );
      // Continue with DB deletion
    }

    // 4. Delete from database
    await this.containerRepo.delete(id);
  }
}
