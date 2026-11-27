import { api } from '@/shared/api/client';

export const containerOpsService = {
  /** 컨테이너 로그 마지막 lines 줄 (서버가 최대 2000 으로 자름) */
  async getLogs(dockerId: string, lines: number): Promise<string> {
    const { data } = await api.get<{ text: string }>(
      `/docker/containers/${encodeURIComponent(dockerId)}/logs`,
      { params: { tail: lines } },
    );
    return data.text;
  },

  async restart(dockerId: string): Promise<void> {
    await api.post(
      `/docker/containers/${encodeURIComponent(dockerId)}/restart`,
    );
  },

  async restartStack(project: string): Promise<string[]> {
    const { data } = await api.post<{ restarted: string[] }>(
      `/docker/stacks/${encodeURIComponent(project)}/restart`,
    );
    return data.restarted;
  },
};
