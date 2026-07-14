import { Inject, Injectable } from '@nestjs/common';
import {
  DOCKER_LOG_READER,
  type IDockerLogReader,
} from '../../domain/repositories/log-reader.repository';
import type { DockerLogArchiveSource } from '../../domain/types/log.type';

/** Docker 아카이브(로테이션) 로그 소스 목록 조회 (GET /logs/docker/archive/sources) */
@Injectable()
export class GetDockerArchiveSourcesUseCase {
  constructor(
    @Inject(DOCKER_LOG_READER)
    private readonly dockerLogReader: IDockerLogReader,
  ) {}

  execute(containerId: string): Promise<DockerLogArchiveSource[]> {
    return this.dockerLogReader.listArchiveSources(containerId);
  }
}
