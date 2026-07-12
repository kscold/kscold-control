import { Injectable, Inject, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(RemoveContainerUseCase.name);

  constructor(
    @Inject(CONTAINER_REPOSITORY)
    private readonly containerRepo: IContainerRepository,
    @Inject(DOCKER_CLIENT)
    private readonly dockerClient: IDockerClient,
    private readonly portForwardingService: PortForwardingService,
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
      try {
        await this.dockerClient.removeContainer(container.dockerId);
      } catch (error) {
        this.logger.error(
          `Failed to remove Docker container ${container.dockerId}:`,
          error,
        );
      }

      try {
        await this.portForwardingService.removePortForwardingRules(
          container.name,
        );
      } catch (error) {
        this.logger.error(
          `Failed to remove port forwarding for ${container.name}:`,
          error,
        );
      }

      await this.containerRepo.delete(container.id);
      return;
    }

    if (ownerId) {
      throw new ContainerNotFoundException(id);
    }

    // Super admins may operate unmanaged external containers by Docker ID.
    try {
      await this.dockerClient.removeContainer(id);
    } catch {
      throw new ContainerNotFoundException(id);
    }
  }
}
