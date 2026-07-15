import { Inject, Injectable } from '@nestjs/common';
import {
  BLOG_LOG_READER,
  FILE_LOG_READER,
  DOCKER_LOG_READER,
  type IBlogLogReader,
  type ILogReader,
  type IDockerLogReader,
} from '../../domain/repositories/log-reader.repository';
import type {
  LogType,
  DockerLogReadOptions,
} from '../../domain/types/log.type';

/** 로그 조회 — 타입별(백엔드/nginx/pm2/docker/blog) 어댑터로 라우팅 (GET /logs) */
@Injectable()
export class GetLogsUseCase {
  constructor(
    @Inject(FILE_LOG_READER)
    private readonly fileLogReader: ILogReader,
    @Inject(DOCKER_LOG_READER)
    private readonly dockerLogReader: IDockerLogReader,
    @Inject(BLOG_LOG_READER)
    private readonly blogLogReader: IBlogLogReader,
  ) {}

  async execute(
    logType: LogType,
    lines: number = 100,
    containerId?: string,
    dockerOptions?: Omit<DockerLogReadOptions, 'containerId'>,
  ): Promise<string[]> {
    switch (logType) {
      case 'docker':
        return this.dockerLogReader.readContainerLogs({
          containerId,
          containerName: dockerOptions?.containerName,
          tail: dockerOptions?.tail ?? lines,
          timestamps: dockerOptions?.timestamps ?? false,
          since: dockerOptions?.since,
          until: dockerOptions?.until,
          filter: dockerOptions?.filter ?? 'all',
        });
      case 'pm2':
        return this.fileLogReader.readLogs(lines, logType);
      case 'backend':
      case 'nginx-access':
      case 'nginx-error':
        return this.fileLogReader.readLogs(lines, logType);
      case 'blog-backend':
      case 'blog-backend-err':
      case 'blog-access':
      case 'blog-frontend':
      case 'blog-frontend-err':
        return this.blogLogReader.readBlogLogs(logType, lines);
      default:
        return [`Unknown log type: ${logType}`];
    }
  }
}
