import { api } from '@/shared/api/client';
import type { CreateMonitorInput, ServiceMonitor } from '../model/uptime.types';

export const uptimeService = {
  async list(): Promise<ServiceMonitor[]> {
    const { data } = await api.get<ServiceMonitor[]>('/uptime/monitors');
    return data;
  },
  async create(input: CreateMonitorInput): Promise<void> {
    await api.post('/uptime/monitors', input);
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/uptime/monitors/${encodeURIComponent(id)}`);
  },
};
