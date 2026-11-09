import { AxiosError } from 'axios';
import { api } from '@/shared/api/client';
import type { SshKeyDownload, SshKeySummary } from '../model/ssh-key.types';

function message(error: unknown, fallback: string): Error {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { message?: unknown } | undefined;
    if (typeof data?.message === 'string') return new Error(data.message);
    if (Array.isArray(data?.message)) return new Error(data.message.join(', '));
  }
  return new Error(fallback);
}

const BASE = '/key-management/ssh-keys';

export const sshKeyVaultService = {
  async list(): Promise<SshKeySummary[]> {
    const { data } = await api.get<SshKeySummary[]>(BASE);
    return data;
  },
  async create(input: {
    name: string;
    description: string;
    privateKey: string;
  }): Promise<SshKeySummary> {
    try {
      const { data } = await api.post<SshKeySummary>(BASE, input);
      return data;
    } catch (error) {
      throw message(error, 'SSH 키를 등록하지 못했습니다.');
    }
  },
  async download(id: string): Promise<SshKeyDownload> {
    try {
      const { data } = await api.post<SshKeyDownload>(`${BASE}/${id}/download`);
      return data;
    } catch (error) {
      throw message(error, 'SSH 키를 내려받지 못했습니다.');
    }
  },
  async remove(id: string): Promise<void> {
    try {
      await api.delete(`${BASE}/${id}`);
    } catch (error) {
      throw message(error, 'SSH 키를 삭제하지 못했습니다.');
    }
  },
};
