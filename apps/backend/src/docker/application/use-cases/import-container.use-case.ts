import { Injectable, Inject } from '@nestjs/common';
import {
  IContainerRepository,
  CONTAINER_REPOSITORY,
} from '../../domain/repositories/container.repository.interface';
import {
  IDockerClient,
  DOCKER_CLIENT,
} from '../../domain/repositories/docker-client.interface';
import { ContainerResponseDto } from '../dto/container-response.dto';
import { PortForwardingService } from '../services/port-forwarding.service';
import { ResourceConfig } from '../../domain/value-objects/resource-config.vo';

/**
 * Import Container Use Case
 * Adopts an existing Docker container into kscold-control management
 */
@Injectable()
export class ImportContainerUseCase {
  constructor(
    @Inject(CONTAINER_REPOSITORY)
    private readonly containerRepo: IContainerRepository,
    @Inject(DOCKER_CLIENT)
    private readonly dockerClient: IDockerClient,
    private readonly portForwardingService: PortForwardingService,
  ) {}

  async execute(
    dockerId: string,
    userId: string,
  ): Promise<ContainerResponseDto> {
    // 1. Check if already managed
    const existing = await this.containerRepo.findByDockerId(dockerId);
    if (existing) {
      throw new Error(
        `Container "${existing.name}" is already managed by this system`,
      );
    }

    // 2. Inspect the Docker container to get its details
    const inspectData = await this.dockerClient.inspectContainer(dockerId);

    // 3. Extract container info
    const name = (inspectData.Name || '').replace(/^\//, '');
    const image = inspectData.Config?.Image || 'unknown';
    const state = inspectData.State?.Status || 'unknown';

    // 4. Extract port mappings
    const ports: Record<string, number> = {};
    const portBindings = inspectData.HostConfig?.PortBindings || {};
    for (const [containerPort, bindings] of Object.entries(portBindings)) {
      if (Array.isArray(bindings) && bindings.length > 0) {
        const hostPort = (bindings[0] as any)?.HostPort;
        if (hostPort) {
          const portNum = containerPort.replace('/tcp', '').replace('/udp', '');
          ports[portNum] = parseInt(hostPort, 10);
        }
      }
    }

    // 5. Extract resource limits
    const nanoCpus = inspectData.HostConfig?.NanoCpus || 0;
    const cpus = nanoCpus > 0 ? nanoCpus / 1e9 : 0;
    const memoryBytes = inspectData.HostConfig?.Memory || 0;
    const memory =
      memoryBytes > 0 ? ResourceConfig.formatBytes(memoryBytes) : '0';

    // 6. Save to database
    const container = this.containerRepo.create({
      dockerId,
      name,
      image,
      status: state === 'running' ? 'running' : 'stopped',
      ports,
      resources: { cpus, memory },
      environment: {},
      userId,
    });

    const savedContainer = await this.containerRepo.save(container);

    // 7. Get external access info
    const externalAccess = this.portForwardingService.getExternalAccess(ports);

    return ContainerResponseDto.fromEntity(
      savedContainer,
      state,
      externalAccess,
    );
  }
}
