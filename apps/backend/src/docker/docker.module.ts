import { forwardRef, Module } from '@nestjs/common';
import { TOPOLOGY_LAYOUT_REPOSITORY } from './domain/repositories/topology-layout.repository.interface';
import { TypeOrmTopologyLayoutRepository } from './infrastructure/repositories/typeorm-topology-layout.repository';
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

// Presentation
import { DockerController } from './presentation/controllers/docker.controller';

import { AuthModule } from '../auth/auth.module';
import { NginxModule } from '../nginx/nginx.module';
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
    forwardRef(() => NginxModule),
    TypeOrmModule.forFeature([Container, TopologyNodeLayout]),
    AuthModule,
    UpnpModule,
  ],
  controllers: [DockerController],
  providers: [
    {
      provide: TOPOLOGY_LAYOUT_REPOSITORY,
      useClass: TypeOrmTopologyLayoutRepository,
    },
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
