import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  IContainerRepository,
  CONTAINER_REPOSITORY,
} from '../../domain/repositories/container.repository.interface';
import {
  IDockerClient,
  DOCKER_CLIENT,
} from '../../domain/gateways/docker-client.gateway.interface';
import { ContainerResponseDto } from '../dto';
import { PortForwardingService } from '../services/port-forwarding.service';
import { ResourceConfig } from '../../domain/value-objects/resource-config.vo';
import { ComposeService } from '../services/compose.service';

/**
 * Docker와 DB를 함께 조회해 컨테이너 목록 구성함.
 */
@Injectable()
export class ListContainersUseCase {
  private readonly logger = new Logger(ListContainersUseCase.name);

  constructor(
    @Inject(CONTAINER_REPOSITORY)
    private readonly containerRepo: IContainerRepository,
    @Inject(DOCKER_CLIENT)
    private readonly dockerClient: IDockerClient,
    private readonly portForwardingService: PortForwardingService,
    private readonly composeService: ComposeService,
  ) {}

  async execute(userId?: string): Promise<ContainerResponseDto[]> {
    // 1. Docker 기준 실행 중인 컨테이너 목록을 먼저 읽음.
    const dockerContainers = await this.dockerClient.listContainers(true);

    // 2. 사용자 범위에 맞는 관리 대상 컨테이너를 DB에서 읽음.
    const dbContainers = userId
      ? await this.containerRepo.findByUserId(userId)
      : await this.containerRepo.findAll();
    const composeServices = new Set(this.composeService.listServices());

    // 3. Docker 정보와 DB 정보를 합쳐 응답 DTO를 만듦.
    const results = await Promise.all(
      dockerContainers.map(async (dc) => {
        const dbContainer = dbContainers.find((dbc) =>
          dc.id.startsWith(dbc.dockerId),
        );

        const isManaged = !!dbContainer;
        const isComposeManaged = composeServices.has(dc.name);

        // 포트 매핑을 API 응답 형식으로 정리함.
        const ports: Record<string, number> = {};
        dc.ports.forEach((p) => {
          if (p.publicPort && p.privatePort) {
            ports[p.privatePort.toString()] = p.publicPort;
          }
        });

        // inspect 성공 시 Docker 기준 리소스를 우선 사용하고,
        // 실패하면 관리 대상 컨테이너는 DB 값을 대체값으로 사용함.
        let resources = dbContainer?.resources ?? { cpus: 0, memory: '0' };
        try {
          const inspectData = await this.dockerClient.inspectContainer(dc.id);

          const nanoCpus = inspectData.HostConfig?.NanoCpus || 0;
          const cpus = nanoCpus > 0 ? nanoCpus / 1e9 : 0;

          const memoryBytes = inspectData.HostConfig?.Memory || 0;
          const memory =
            memoryBytes > 0 ? ResourceConfig.formatBytes(memoryBytes) : '0';

          resources = { cpus, memory };
        } catch (error) {
          this.logger.error(`Failed to inspect container ${dc.id}:`, error);
        }

        // 외부 접속 정보는 포트 기준으로 다시 계산함.
        const externalAccess =
          this.portForwardingService.getExternalAccess(ports);

        // 관리 대상 컨테이너는 DB 포트 정보를 최신화함.
        if (isManaged && dbContainer) {
          if (JSON.stringify(dbContainer.ports) !== JSON.stringify(ports)) {
            dbContainer.ports = ports;
            await this.containerRepo.save(dbContainer);
          }

          return ContainerResponseDto.fromEntity(
            { ...dbContainer, resources },
            dc.state,
            externalAccess,
            isComposeManaged,
          );
        }

        // 사용자 범위 조회에서는 관리되지 않는 외부 컨테이너를 숨김.
        if (userId) {
          return null;
        }

        // 외부 컨테이너는 가상 DTO로 내려줌.
        return ContainerResponseDto.fromDockerContainer(
          dc,
          ports,
          resources,
          externalAccess,
          isComposeManaged,
        );
      }),
    );

    return results.filter(
      (item): item is ContainerResponseDto => item !== null,
    );
  }
}
