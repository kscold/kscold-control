import type {
  Pm2LogResult,
  DockerContainerSummary,
  DockerLogArchiveSource,
  DockerLogReadOptions,
  NginxStatus,
  SystemInfo,
} from '../types/log.type';
import type { ChildProcessWithoutNullStreams } from 'child_process';

export interface ILogReader {
  readLogs(lines: number, target?: string): Promise<string[]>;
}

export interface IDockerLogReader extends ILogReader {
  readContainerLogs(options: DockerLogReadOptions): Promise<string[]>;
  readArchiveLogs(
    options: DockerLogReadOptions & { sourceId: string },
  ): Promise<string[]>;
  listArchiveSources(containerId: string): Promise<DockerLogArchiveSource[]>;
  createLogStream(
    options: DockerLogReadOptions,
  ): ChildProcessWithoutNullStreams;
  applyFilters(lines: string[], options: DockerLogReadOptions): string[];
  listContainers(): Promise<DockerContainerSummary[]>;
}

export interface IPm2LogReader extends ILogReader {
  getPm2Logs(lines: number): Promise<Pm2LogResult>;
}

export interface ISystemStatusReader {
  getNginxStatus(): Promise<NginxStatus>;
  getSystemInfo(): Promise<SystemInfo | null>;
}

export const FILE_LOG_READER = Symbol('FILE_LOG_READER');
export const DOCKER_LOG_READER = Symbol('DOCKER_LOG_READER');
export const PM2_LOG_READER = Symbol('PM2_LOG_READER');
export const SYSTEM_STATUS_READER = Symbol('SYSTEM_STATUS_READER');
