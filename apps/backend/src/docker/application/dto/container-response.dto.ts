import { Container } from '../../domain/entities/container.entity';

/**
 * Container Response DTO
 * Never expose raw entity - use this DTO for API responses
 */
export class ContainerResponseDto {
  id: string;
  dockerId: string;
  name: string;
  image: string;
  status: string;
  liveStatus?: string; // Real-time status from Docker
  ports: Record<string, number>;
  resources: {
    cpus: number;
    memory: string;
  };
  createdAt: string;
  externalAccess?: {
    ssh?: string;
    http?: string;
    domain: string;
  };
  isManaged: boolean; // True if created by this system, False if external

  /**
   * Map entity to response DTO
   */
  static fromEntity(
    container: Container,
    liveStatus?: string,
    externalAccess?: any,
  ): ContainerResponseDto {
    return {
      id: container.id,
      dockerId: container.dockerId,
      name: container.name,
      image: container.image,
      status: container.status,
      liveStatus,
      ports: container.ports,
      resources: container.resources,
      createdAt: container.createdAt.toISOString(),
      externalAccess,
      isManaged: true,
    };
  }

  /**
   * Create DTO from Docker container (not in DB)
   */
  static fromDockerContainer(
    dockerContainer: any,
    ports: Record<string, number>,
    resources: { cpus: number; memory: string },
    externalAccess?: any,
  ): ContainerResponseDto {
    return {
      id: dockerContainer.id, // Use Docker ID as ID for unmanaged
      dockerId: dockerContainer.id,
      name: dockerContainer.name || 'Unknown',
      image: dockerContainer.image || 'Unknown',
      status: dockerContainer.state,
      liveStatus: dockerContainer.state,
      ports,
      resources,
      createdAt: new Date(dockerContainer.created * 1000).toISOString(),
      externalAccess,
      isManaged: false,
    };
  }

  /**
   * Map array of entities to DTOs
   */
  static fromEntities(
    containers: Array<{
      container: Container;
      liveStatus?: string;
      externalAccess?: any;
    }>,
  ): ContainerResponseDto[] {
    return containers.map(({ container, liveStatus, externalAccess }) =>
      ContainerResponseDto.fromEntity(container, liveStatus, externalAccess),
    );
  }
}
