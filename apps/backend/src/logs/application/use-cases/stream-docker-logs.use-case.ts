import { Inject, Injectable } from '@nestjs/common';
import {
  DOCKER_LOG_READER,
  type IDockerLogReader,
} from '../../domain/repositories/log-reader.repository';
import type { DockerLogReadOptions } from '../../domain/types/log.type';
import type { ChildProcessWithoutNullStreams } from 'child_process';

/**
 * Docker 로그 실시간 스트림 (GET /logs/docker/stream).
 * 스트림 프로세스 생성(execute)과 라인 필터(filterLines)를 제공한다.
 * SSE 전송(res 헤더/write/heartbeat)은 presentation(컨트롤러)에서 담당하며,
 * 어댑터 위임 로직은 기존 동작과 동일하다.
 */
@Injectable()
export class StreamDockerLogsUseCase {
  constructor(
    @Inject(DOCKER_LOG_READER)
    private readonly dockerLogReader: IDockerLogReader,
  ) {}

  execute(options: DockerLogReadOptions): ChildProcessWithoutNullStreams {
    return this.dockerLogReader.createLogStream(options);
  }

  filterLines(lines: string[], options: DockerLogReadOptions): string[] {
    return this.dockerLogReader.applyFilters(lines, options);
  }
}
