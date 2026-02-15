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
 * List Containers Use Case
 * Retrieves all containers with live status from Docker
 */
@Injectable()
export class ListContainersUseCase {
  constructor(
    @Inject(CONTAINER_REPOSITORY)
    private readonly containerRepo: IContainerRepository,
    @Inject(DOCKER_CLIENT)
    private readonly dockerClient: IDockerClient,
    private readonly portForwardingService: PortForwardingService,
  ) {}

  async execute(userId?: string): Promise<ContainerResponseDto[]> {
    // 1. Get containers from Docker
    const dockerContainers = await this.dockerClient.listContainers(true);

    // 2. Get containers from DB
    const dbContainers = userId
      ? await this.containerRepo.findByUserId(userId)
      : await this.containerRepo.findAll();

    // 3. Match Docker containers with DB containers
    const results = await Promise.all(
      dockerContainers.map(async (dc) => {
        const dbContainer = dbContainers.find((dbc) =>
          dc.id.startsWith(dbc.dockerId),
        );

        const isManaged = !!dbContainer;

        // Parse ports
        const ports: Record<string, number> = {};
        dc.ports.forEach((p) => {
          if (p.publicPort && p.privatePort) {
            ports[p.privatePort.toString()] = p.publicPort;
          }
        });

        // Get resource info from Docker inspection
        let resources = { cpus: 0, memory: '0' };
        try {
          const inspectData = await this.dockerClient.inspectContainer(dc.id);

          const nanoCpus = inspectData.HostConfig?.NanoCpus || 0;
          const cpus = nanoCpus > 0 ? nanoCpus / 1e9 : 0;

          const memoryBytes = inspectData.HostConfig?.Memory || 0;
          const memory =
            memoryBytes > 0 ? ResourceConfig.formatBytes(memoryBytes) : '0';

          resources = { cpus, memory };
        } catch (error) {
          console.error(`Failed to inspect container ${dc.id}:`, error);
        }

        // Get external access info
        const externalAccess =
          this.portForwardingService.getExternalAccess(ports);

        // If managed, update DB container if needed
        if (isManaged && dbContainer) {
          if (JSON.stringify(dbContainer.ports) !== JSON.stringify(ports)) {
            dbContainer.ports = ports;
            await this.containerRepo.save(dbContainer);
          }

          return ContainerResponseDto.fromEntity(
            { ...dbContainer, resources },
            dc.state,
            externalAccess,
          );
        }

        // For unmanaged containers, create a virtual DTO
        return ContainerResponseDto.fromDockerContainer(
          dc,
          ports,
          resources,
          externalAccess,
        );
      }),
    );

    return results;
  }
}
