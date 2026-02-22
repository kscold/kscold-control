import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Domain
import { Container } from './domain/entities/container.entity';
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
} from './application/use-cases';
import { PortForwardingService } from './application/services/port-forwarding.service';
import { ComposeService } from './application/services/compose.service';

// Infrastructure
import { TypeOrmContainerRepository } from './infrastructure/repositories/typeorm-container.repository';
import { DockerodeClientAdapter } from './infrastructure/adapters/dockerode-client.adapter';

// Presentation
import { DockerController } from './presentation/controllers/docker.controller';

import { AuthModule } from '../auth/auth.module';

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
  imports: [TypeOrmModule.forFeature([Container]), AuthModule],
  controllers: [DockerController],
  providers: [
    // Use Cases
    CreateContainerUseCase,
    ListContainersUseCase,
    StartContainerUseCase,
    StopContainerUseCase,
    RemoveContainerUseCase,
    ImportContainerUseCase,

    // Services
    PortForwardingService,
    ComposeService,

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
  ],
})
export class DockerModule {}
