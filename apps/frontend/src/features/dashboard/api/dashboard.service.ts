import { api } from '@/shared/api/client';
import type {
  ContainerInfo,
  LiveStats,
  SystemInfo,
} from '../model/dashboard.types';

export const dashboardService = {
  async listContainers(): Promise<ContainerInfo[]> {
    const { data } = await api.get<ContainerInfo[]>('/docker/containers');
    return data;
  },

  async getLiveStats(): Promise<LiveStats> {
    const { data } = await api.get<LiveStats>('/system/stats');
    return data;
  },

  async getSystemInfo(): Promise<SystemInfo> {
    const { data } = await api.get<SystemInfo>('/system/info');
    return data;
  },
};
