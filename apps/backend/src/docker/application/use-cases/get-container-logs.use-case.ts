import { Inject, Injectable } from '@nestjs/common';
import { ContainerNotFoundException } from '../../../common/exceptions';
import {
  CONTAINER_REPOSITORY,
  type IContainerRepository,
} from '../../domain/repositories/container.repository.interface';
import {
  DOCKER_CLIENT,
  type IDockerClient,
} from '../../domain/gateways/docker-client.gateway.interface';

/** 화면이 한 번에 받는 로그 줄 수 범위. 너무 크면 휴대폰에서 멈춘다. */
export const MAX_LOG_LINES = 2000;
const DEFAULT_LOG_LINES = 300;

export function clampLogLines(value: unknown): number {
  const lines = Number(value);
  if (!Number.isFinite(lines) || lines <= 0) return DEFAULT_LOG_LINES;
  return Math.min(Math.floor(lines), MAX_LOG_LINES);
}

/**
 * 컨테이너 로그 마지막 몇 줄을 읽음.
 * 권한 범위는 프로세스 조회와 같음: 일반 사용자는 자기 컨테이너만, 전역 관리자는 외부 컨테이너도.
 */
@Injectable()
export class GetContainerLogsUseCase {
  constructor(
    @Inject(CONTAINER_REPOSITORY)
    private readonly containerRepository: IContainerRepository,
    @Inject(DOCKER_CLIENT) private readonly dockerClient: IDockerClient,
  ) {}

  async execute(
    dockerId: string,
    tail: unknown,
    ownerId?: string,
  ): Promise<{ lines: number; text: string }> {
    if (ownerId) {
      const container = await this.containerRepository.findByDockerId(dockerId);
      if (!container || container.userId !== ownerId) {
        throw new ContainerNotFoundException(dockerId);
      }
    }
    const lines = clampLogLines(tail);
    return {
      lines,
      text: await this.dockerClient.getContainerLogs(dockerId, lines),
    };
  }
}
