import { api } from '@/shared/api/client';
import type {
  DashboardContainerSummary,
  LiveStats,
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

  async getContainerSummary(): Promise<DashboardContainerSummary> {
    const { data } = await api.get<DashboardContainerSummary>(
      '/docker/dashboard/container-summary',
    );
    return data;
  },
};
