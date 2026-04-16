import { Inject, Injectable } from '@nestjs/common';
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
          filter: dockerOptions?.filter ?? 'all',
        });
      case 'pm2':
        return this.fileLogReader.readLogs(lines, logType);
      case 'backend':
      case 'nginx-access':
      case 'nginx-error':
        return this.fileLogReader.readLogs(lines, logType);
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
}
