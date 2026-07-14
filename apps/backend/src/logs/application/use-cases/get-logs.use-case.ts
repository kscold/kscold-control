import { Inject, Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  FILE_LOG_READER,
  DOCKER_LOG_READER,
  type ILogReader,
  type IDockerLogReader,
} from '../../domain/repositories/log-reader.repository';
import type {
  LogType,
  DockerLogReadOptions,
} from '../../domain/types/log.type';

const execAsync = promisify(exec);

const BLOG_LOG_MAP: Record<string, string> = {
  'blog-backend': '/var/log/kscold-blog-backend.log',
  'blog-backend-err': '/var/log/kscold-blog-backend-err.log',
  'blog-access': '/var/log/kscold-blog/access.log',
  'blog-frontend': '/var/log/kscold-blog-frontend.log',
  'blog-frontend-err': '/var/log/kscold-blog-frontend-err.log',
};

/** 로그 조회 — 타입별(백엔드/nginx/pm2/docker/blog) 어댑터로 라우팅 (GET /logs) */
@Injectable()
export class GetLogsUseCase {
  constructor(
    @Inject(FILE_LOG_READER)
    private readonly fileLogReader: ILogReader,
    @Inject(DOCKER_LOG_READER)
    private readonly dockerLogReader: IDockerLogReader,
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
        return this.readBlogContainerLog(logType, lines);
      default:
        return [`Unknown log type: ${logType}`];
    }
  }

  private async readBlogContainerLog(
    logType: string,
    lines: number,
  ): Promise<string[]> {
    const filePath = BLOG_LOG_MAP[logType];
    if (!filePath) return [`Unknown blog log type: ${logType}`];

    const dockerHost = process.env.DOCKER_HOST || 'unix:///var/run/docker.sock';
    const tail = lines > 0 ? lines : 200;
    const cmd = `DOCKER_HOST=${dockerHost} docker exec ubuntu-blog tail -n ${tail} ${filePath}`;

    try {
      const { stdout } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 });
      return stdout.split('\n').filter((line) => line.trim());
    } catch (error: any) {
      return [`Error reading blog log (${logType}): ${error.message}`];
    }
  }
}
