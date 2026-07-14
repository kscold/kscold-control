import { Inject, Injectable } from '@nestjs/common';
import {
  DOCKER_LOG_READER,
  type IDockerLogReader,
} from '../../domain/repositories/log-reader.repository';
import type { DockerContainerSummary } from '../../domain/types/log.type';

/** Docker 컨테이너 목록 조회 (GET /logs/docker/containers) */
@Injectable()
export class GetDockerContainersUseCase {
  constructor(
    @Inject(DOCKER_LOG_READER)
    private readonly dockerLogReader: IDockerLogReader,
  ) {}

  execute(): Promise<DockerContainerSummary[]> {
    return this.dockerLogReader.listContainers();
  }
}
