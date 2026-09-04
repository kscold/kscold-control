import { Module } from '@nestjs/common';
import { TOPOLOGY_LAYOUT_REPOSITORY } from './domain/repositories/topology-layout.repository.interface';
import { TypeOrmTopologyLayoutRepository } from './infrastructure/repositories/typeorm-topology-layout.repository';
import { TypeOrmModule } from '@nestjs/typeorm';

// 도메인
import { Container } from './domain/entities/container.entity';
import { TopologyNodeLayout } from './domain/entities/topology-node-layout.entity';
import { CONTAINER_REPOSITORY } from './domain/repositories/container.repository.interface';
import { DOCKER_CLIENT } from './domain/gateways/docker-client.gateway.interface';
import { COMPOSE_RUNTIME_GATEWAY } from './domain/gateways/compose-runtime.gateway.interface';
import { DOCKER_CLEANUP_GATEWAY } from './domain/gateways/docker-cleanup.gateway.interface';
import { DOCKER_ARTIFACT_GATEWAY } from './domain/gateways/docker-artifact.gateway.interface';

// 애플리케이션
import {
  CreateContainerUseCase,
  ListContainersUseCase,
  GetContainerProcessesUseCase,
  StartContainerUseCase,
  StopContainerUseCase,
  RemoveContainerUseCase,
  ImportContainerUseCase,
  GetComposeProvisioningTemplateUseCase,
  CreateComposeServiceUseCase,
  RemoveComposeServiceUseCase,
  ListComposeServicesUseCase,
  GetTopologySnapshotUseCase,
  SaveTopologyLayoutUseCase,
  GetDockerCleanupCandidatesUseCase,
  PruneDanglingImagesUseCase,
  PruneBuildCacheUseCase,
  PruneExitedContainersUseCase,
  PruneDanglingVolumesUseCase,
} from './application/use-cases';
import { PortForwardingService } from './application/services/port-forwarding.service';
import { ComposeService } from './application/services/compose.service';
import { DockerTopologyService } from './application/services/docker-topology.service';
import { DockerCleanupService } from './application/services/docker-cleanup.service';

// 인프라
import { TypeOrmContainerRepository } from './infrastructure/repositories/typeorm-container.repository';
import { DockerodeClientAdapter } from './infrastructure/adapters/dockerode-client.adapter';
import { DockerComposeRuntimeAdapter } from './infrastructure/adapters/docker-compose-runtime.adapter';
import { DockerArtifactAdapter } from './infrastructure/adapters/docker-artifact.adapter';
import { DockerCleanupAdapter } from './infrastructure/adapters/docker-cleanup.adapter';

// 표현
import { DockerController } from './presentation/controllers/docker.controller';

import { AuthModule } from '../auth/auth.module';
import { NginxInfrastructureModule } from '../nginx/nginx-infrastructure.module';
import { UpnpModule } from '../upnp/upnp.module';

/**
 * Docker 모듈
 *
 * 도메인은 외부 시스템과 무관한 계약만 선언하고, 애플리케이션은 정책과
 * 유스케이스를 조합함. 실제 Docker 명령줄 도구, Compose 파일, TypeORM 접근은
 * 인프라 어댑터가 담당하며, 이 모듈이 세 계층을 연결함.
 *
 * 의존성 방향:
 * - 도메인: 엔티티·값 객체·포트만 선언하며 외부 계층을 참조하지 않음.
 * - 애플리케이션: 도메인 포트를 통해 업무 흐름 실행함.
 * - 인프라: 도메인 포트의 Docker·파일·DB 구현체 제공함.
 * - 표현: HTTP 요청을 애플리케이션 유스케이스로 전달함.
 */
@Module({
  imports: [
    NginxInfrastructureModule,
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
    // 유스케이스
    CreateContainerUseCase,
    ListContainersUseCase,
    GetContainerProcessesUseCase,
    StartContainerUseCase,
    StopContainerUseCase,
    RemoveContainerUseCase,
    ImportContainerUseCase,
    GetComposeProvisioningTemplateUseCase,
    CreateComposeServiceUseCase,
    RemoveComposeServiceUseCase,
    ListComposeServicesUseCase,
    GetTopologySnapshotUseCase,
    SaveTopologyLayoutUseCase,
    GetDockerCleanupCandidatesUseCase,
    PruneDanglingImagesUseCase,
    PruneBuildCacheUseCase,
    PruneExitedContainersUseCase,
    PruneDanglingVolumesUseCase,

    // 애플리케이션 서비스
    PortForwardingService,
    ComposeService,
    DockerTopologyService,
    DockerCleanupService,

    // 영속성 포트 구현체
    {
      provide: CONTAINER_REPOSITORY,
      useClass: TypeOrmContainerRepository,
    },

    // Docker 및 호스트 런타임 포트 구현체
    {
      provide: DOCKER_CLIENT,
      useClass: DockerodeClientAdapter,
    },
    {
      provide: COMPOSE_RUNTIME_GATEWAY,
      useClass: DockerComposeRuntimeAdapter,
    },
    {
      provide: DOCKER_CLEANUP_GATEWAY,
      useClass: DockerCleanupAdapter,
    },
    {
      provide: DOCKER_ARTIFACT_GATEWAY,
      useClass: DockerArtifactAdapter,
    },
  ],
  exports: [
    // 다른 모듈에서 재사용하는 유스케이스
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
