import type {
  Pm2LogResult,
  DockerContainerSummary,
  NginxStatus,
  SystemInfo,
} from '../types/log.type';

export interface ILogReader {
  readLogs(lines: number, target?: string): Promise<string[]>;
}

export interface IDockerLogReader extends ILogReader {
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
