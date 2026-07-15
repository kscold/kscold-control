import { Injectable, Inject } from '@nestjs/common';
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

/**
 * 외부 컨테이너 가져오기 유스케이스임.
 * 기존 Docker 컨테이너의 설정을 읽어 현재 사용자의 관리 대상으로 등록함.
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
    // 이미 다른 관리 기록이 있는 Docker 컨테이너는 중복 등록하지 않음.
    const existing = await this.containerRepo.findByDockerId(dockerId);
    if (existing) {
      throw new Error(
        `Container "${existing.name}" is already managed by this system`,
      );
    }

    // Docker inspect 응답에서 관리에 필요한 실제 설정 조회함.
    const inspectData = await this.dockerClient.inspectContainer(dockerId);

    // Docker API의 이름 앞 슬래시를 제거해 화면과 DB에서 같은 이름 사용함.
    const name = (inspectData.Name || '').replace(/^\//, '');
    const image = inspectData.Config?.Image || 'unknown';
    const state = inspectData.State?.Status || 'unknown';

    // Docker의 "내부 포트/프로토콜" 키를 관리 모델의 "내부 포트" 키로 정규화함.
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

    // Docker가 NanoCPU와 바이트로 저장한 자원 제한을 도메인 표현으로 변환함.
    const nanoCpus = inspectData.HostConfig?.NanoCpus || 0;
    const cpus = nanoCpus > 0 ? nanoCpus / 1e9 : 0;
    const memoryBytes = inspectData.HostConfig?.Memory || 0;
    const memory =
      memoryBytes > 0 ? ResourceConfig.formatBytes(memoryBytes) : '0';

    // 가져온 컨테이너도 현재 사용자 소유로 저장해야 이후 조회·제어 권한을 확인할 수 있음.
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

    // 설정된 포트를 기준으로 사용할 수 있는 외부 접속 정보를 계산함.
    const externalAccess = this.portForwardingService.getExternalAccess(ports);

    return ContainerResponseDto.fromEntity(
      savedContainer,
      state,
      externalAccess,
    );
  }
}
