import { Inject, Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const BLOG_LOG_MAP: Record<string, string> = {
  'blog-backend': '/var/log/kscold-blog-backend.log',
  'blog-backend-err': '/var/log/kscold-blog-backend-err.log',
  'blog-access': '/var/log/kscold-blog/access.log',
  'blog-frontend': '/var/log/kscold-blog-frontend.log',
  'blog-frontend-err': '/var/log/kscold-blog-frontend-err.log',
};
import {
  FILE_LOG_READER,
  DOCKER_LOG_READER,
  PM2_LOG_READER,
  SYSTEM_STATUS_READER,
  type ILogReader,
  type IDockerLogReader,
  type IPm2LogReader,
  type ISystemStatusReader,
} from '../../domain/interfaces/log-reader.repository';
import type {
  LogType,
  Pm2LogResult,
  DockerContainerSummary,
  DockerLogArchiveSource,
  DockerLogReadOptions,
  NginxStatus,
  SystemInfo,
} from '../../domain/types/log.type';
import type { ChildProcessWithoutNullStreams } from 'child_process';

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  constructor(
    @Inject(FILE_LOG_READER)
    private readonly fileLogReader: ILogReader,
    @Inject(DOCKER_LOG_READER)
    private readonly dockerLogReader: IDockerLogReader,
    @Inject(PM2_LOG_READER)
    private readonly pm2LogReader: IPm2LogReader,
    @Inject(SYSTEM_STATUS_READER)
    private readonly systemStatusReader: ISystemStatusReader,
  ) {}

  async getLogs(
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

  async getPm2Logs(lines: number = 100): Promise<Pm2LogResult> {
    return this.pm2LogReader.getPm2Logs(lines);
  }

  async getDockerContainers(): Promise<DockerContainerSummary[]> {
    return this.dockerLogReader.listContainers();
  }

  async getDockerArchiveSources(
    containerId: string,
  ): Promise<DockerLogArchiveSource[]> {
    return this.dockerLogReader.listArchiveSources(containerId);
  }

  async getDockerArchiveLogs(
    options: DockerLogReadOptions & { sourceId: string },
  ): Promise<string[]> {
    return this.dockerLogReader.readArchiveLogs(options);
  }

  createDockerLogStream(
    options: DockerLogReadOptions,
  ): ChildProcessWithoutNullStreams {
    return this.dockerLogReader.createLogStream(options);
  }

  filterDockerLogLines(
    lines: string[],
    options: DockerLogReadOptions,
  ): string[] {
    return this.dockerLogReader.applyFilters(lines, options);
  }

  async getNginxStatus(): Promise<NginxStatus> {
    return this.systemStatusReader.getNginxStatus();
  }

  async getSystemInfo(): Promise<SystemInfo | null> {
    return this.systemStatusReader.getSystemInfo();
  }

  logFrontendError(info: {
    message: string;
    stack?: string;
    componentStack?: string;
    url?: string;
  }): void {
    this.logger.error(
      `[FrontendError] ${info.message} url=${info.url ?? '-'}`,
      info.stack,
    );
    if (info.componentStack) {
      this.logger.debug(`[FrontendError] componentStack: ${info.componentStack}`);
    }
  }

  private async readBlogContainerLog(
    logType: string,
    lines: number,
  ): Promise<string[]> {
    const filePath = BLOG_LOG_MAP[logType];
    if (!filePath) return [`Unknown blog log type: ${logType}`];

    const dockerHost =
      process.env.DOCKER_HOST || 'unix:///var/run/docker.sock';
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
