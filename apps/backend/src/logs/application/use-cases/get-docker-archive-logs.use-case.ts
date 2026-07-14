import { Inject, Injectable } from '@nestjs/common';
import {
  DOCKER_LOG_READER,
  type IDockerLogReader,
} from '../../domain/repositories/log-reader.repository';
import type { DockerLogReadOptions } from '../../domain/types/log.type';

/** Docker 아카이브 로그 조회 (GET /logs/docker/archive) */
@Injectable()
export class GetDockerArchiveLogsUseCase {
  constructor(
    @Inject(DOCKER_LOG_READER)
    private readonly dockerLogReader: IDockerLogReader,
  ) {}

  execute(
    options: DockerLogReadOptions & { sourceId: string },
  ): Promise<string[]> {
    return this.dockerLogReader.readArchiveLogs(options);
  }
}
