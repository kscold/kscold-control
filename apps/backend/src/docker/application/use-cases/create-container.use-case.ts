import { Injectable, Inject } from '@nestjs/common';
import {
  IContainerRepository,
  CONTAINER_REPOSITORY,
} from '../../domain/repositories/container.repository.interface';
import {
  IDockerClient,
  DOCKER_CLIENT,
} from '../../domain/repositories/docker-client.interface';
import { ResourceConfig } from '../../domain/value-objects/resource-config.vo';
import { CreateContainerDto } from '../dto/create-container.dto';
import { ContainerResponseDto } from '../dto/container-response.dto';
import { PortForwardingService } from '../services/port-forwarding.service';

/**
 * Create Container Use Case
 * Handles container creation business logic
 */
@Injectable()
export class CreateContainerUseCase {
  constructor(
    @Inject(CONTAINER_REPOSITORY)
    private readonly containerRepo: IContainerRepository,
    @Inject(DOCKER_CLIENT)
    private readonly dockerClient: IDockerClient,
    private readonly portForwardingService: PortForwardingService,
  ) {}

  async execute(dto: CreateContainerDto): Promise<ContainerResponseDto> {
    // 1. Validate resources using Value Object
    const resources = ResourceConfig.create(
      dto.resources.cpus,
      dto.resources.memory,
    );

    // 2. Pull image if needed
    await this.dockerClient.pullImage(dto.image);

    // 3. Create container in Docker
    const dockerId = await this.dockerClient.createContainer({
      name: dto.name,
      image: dto.image,
      ports: dto.ports,
      resources: {
        cpus: resources.cpus,
        memory: resources.memory,
      },
      environment: dto.environment,
    });

    // 4. Save to database
    const container = this.containerRepo.create({
      dockerId,
      name: dto.name,
      image: dto.image,
      status: 'created',
      ports: dto.ports,
      resources: {
        cpus: resources.cpus,
        memory: resources.memory,
      },
      environment: dto.environment,
      userId: dto.userId,
    });

    const savedContainer = await this.containerRepo.save(container);

    // 5. Setup port forwarding (async, don't wait)
    this.portForwardingService
      .addPortForwardingRules(dto.name, dto.ports)
      .catch((err) => console.error('Failed to setup port forwarding:', err));

    // 6. Get external access info
    const externalAccess = this.portForwardingService.getExternalAccess(
      dto.ports,
    );

    // 7. Return DTO
    return ContainerResponseDto.fromEntity(
      savedContainer,
      'created',
      externalAccess,
    );
  }
}
