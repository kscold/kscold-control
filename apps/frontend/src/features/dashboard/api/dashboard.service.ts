import { api } from '@/shared/api/client';
import type {
  DashboardContainerSummary,
  LiveStats,
  MetricPoint,
  RemoteAccessPath,
  SystemInfo,
} from '../model/dashboard.types';

export const dashboardService = {
  async getLiveStats(): Promise<LiveStats> {
    const { data } = await api.get<LiveStats>('/system/dashboard/stats');
    return data;
  },

  async getSystemInfo(): Promise<SystemInfo> {
    const { data } = await api.get<SystemInfo>('/system/dashboard/info');
    return data;
  },

  async getHistory(hours: number): Promise<MetricPoint[]> {
    const { data } = await api.get<{ points: MetricPoint[] }>(
      '/system/dashboard/history',
      { params: { hours } },
    );
    return data.points;
  },

  async getRemoteAccess(): Promise<RemoteAccessPath[]> {
    const { data } = await api.get<RemoteAccessPath[]>(
      '/system/dashboard/remote-access',
    );
    return data;
  },

  async getContainerSummary(): Promise<DashboardContainerSummary> {
    const { data } = await api.get<DashboardContainerSummary>(
      '/docker/dashboard/container-summary',
    );
    return data;
  },
};
