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
  NginxStatus,
  SystemInfo,
} from '../../domain/types/log.type';

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
  ): Promise<string[]> {
    switch (logType) {
      case 'docker':
        return this.dockerLogReader.readLogs(lines, containerId);
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

  async getNginxStatus(): Promise<NginxStatus> {
    return this.systemStatusReader.getNginxStatus();
  }

  async getSystemInfo(): Promise<SystemInfo | null> {
    return this.systemStatusReader.getSystemInfo();
  }
}
