import { api } from '@/shared/api/client';
import { API_URL } from '@/shared/config';
import type {
  DockerContainer,
  DockerLogArchiveSource,
  LogLineCount,
  LogType,
} from '../model/logs.types';

interface Pm2LogsResponse {
  out: string[];
  error: string[];
}

interface LogsResponse {
  logs?: string[];
}

export const logsService = {
  async listDockerContainers(): Promise<DockerContainer[]> {
    const { data } = await api.get<DockerContainer[]>(
      '/logs/docker/containers',
    );
    return data;
  },

  async listArchiveSources(
    containerId: string,
  ): Promise<DockerLogArchiveSource[]> {
    const { data } = await api.get<{ items?: DockerLogArchiveSource[] }>(
      '/logs/docker/archive/sources',
      { params: { containerId } },
    );
    return data.items ?? [];
  },

  async getPm2Logs(lines: LogLineCount): Promise<Pm2LogsResponse> {
    const { data } = await api.get<Pm2LogsResponse>('/logs/pm2', {
      params: { lines },
    });
    return data;
  },

  async getLogs(type: Exclude<LogType, 'docker'>, lines: LogLineCount) {
    const { data } = await api.get<LogsResponse>('/logs', {
      params: { type, lines },
    });
    return data.logs ?? [];
  },

  async getDockerLogs(
    params: URLSearchParams,
    sourceId: string,
  ): Promise<string[]> {
    const endpoint = sourceId === 'live' ? '/logs' : '/logs/docker/archive';
    const { data } = await api.get<LogsResponse>(
      `${endpoint}?${params.toString()}`,
    );
    return data.logs ?? [];
  },

  createDockerStreamUrl(params: URLSearchParams): string {
    return `${API_URL}/api/logs/docker/stream?${params.toString()}`;
  },
};
