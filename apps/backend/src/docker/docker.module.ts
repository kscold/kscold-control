import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Domain
import { Container } from './domain/entities/container.entity';
import { TopologyNodeLayout } from './domain/entities/topology-node-layout.entity';
import { CONTAINER_REPOSITORY } from './domain/repositories/container.repository.interface';
import { DOCKER_CLIENT } from './domain/repositories/docker-client.interface';

// Application
import {
  CreateContainerUseCase,
  ListContainersUseCase,
  StartContainerUseCase,
  StopContainerUseCase,
  RemoveContainerUseCase,
  ImportContainerUseCase,
  GetComposeProvisioningTemplateUseCase,
  CreateComposeServiceUseCase,
  RemoveComposeServiceUseCase,
} from './application/use-cases';
import { PortForwardingService } from './application/services/port-forwarding.service';
import { ComposeService } from './application/services/compose.service';
import { DockerTopologyService } from './application/services/docker-topology.service';
import { DockerCleanupService } from './application/services/docker-cleanup.service';
import { DockerCommandService } from './application/services/docker-command.service';

// Infrastructure
import { TypeOrmContainerRepository } from './infrastructure/repositories/typeorm-container.repository';
import { DockerodeClientAdapter } from './infrastructure/adapters/dockerode-client.adapter';
import { NGINX_CONFIG_REPOSITORY } from '../nginx/domain/interfaces/nginx-config.repository';
import { NginxConfigRepositoryImpl } from '../nginx/infrastructure/repositories/nginx-config.repository.impl';

// Presentation
import { DockerController } from './presentation/controllers/docker.controller';

import { AuthModule } from '../auth/auth.module';
import { UpnpModule } from '../upnp/upnp.module';

/**
 * Docker Module
 * Clean Architecture implementation
 *
 * Dependencies:
 * - Domain: Entities, Interfaces, Value Objects (no dependencies)
 * - Application: Use Cases, DTOs (depends on Domain)
 * - Infrastructure: Repository implementations, Adapters (depends on Application)
 * - Presentation: Controllers (depends on Application)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Container, TopologyNodeLayout]),
    AuthModule,
    UpnpModule,
  ],
  controllers: [DockerController],
  providers: [
    // Use Cases
    CreateContainerUseCase,
    ListContainersUseCase,
    StartContainerUseCase,
    StopContainerUseCase,
    RemoveContainerUseCase,
    ImportContainerUseCase,
    GetComposeProvisioningTemplateUseCase,
    CreateComposeServiceUseCase,
    RemoveComposeServiceUseCase,

    // Services
    PortForwardingService,
    ComposeService,
    DockerTopologyService,
    DockerCleanupService,
    DockerCommandService,

    // Repository Implementations (DI)
    {
      provide: CONTAINER_REPOSITORY,
      useClass: TypeOrmContainerRepository,
    },

    // Docker Client Implementation (DI)
    {
      provide: DOCKER_CLIENT,
      useClass: DockerodeClientAdapter,
    },
    {
      provide: NGINX_CONFIG_REPOSITORY,
      useClass: NginxConfigRepositoryImpl,
    },
  ],
  exports: [
    // Export use cases for potential reuse
    CreateContainerUseCase,
    ListContainersUseCase,
    StartContainerUseCase,
    StopContainerUseCase,
    RemoveContainerUseCase,
    ImportContainerUseCase,
    GetComposeProvisioningTemplateUseCase,
    CreateComposeServiceUseCase,
    RemoveComposeServiceUseCase,
  ],
})
export class DockerModule {}
