import { api } from '@/shared/api/client';

export interface LiveTerminalSession {
  id: string;
  title: string;
  createdAt: string;
  lastActivityAt: string | null;
}

export const terminalSessionsService = {
  async listLive(): Promise<LiveTerminalSession[]> {
    const { data } = await api.get<LiveTerminalSession[]>('/terminal/sessions');
    return data;
  },
};
