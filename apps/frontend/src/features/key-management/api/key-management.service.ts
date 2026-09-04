import { AxiosError } from 'axios';
import { api } from '@/shared/api/client';
import type {
  EnvironmentMutation,
  KeyManagementTarget,
  RevealedEnvironment,
  SecretBackup,
} from '../model/types';

function toSafeError(error: unknown, fallback: string): Error {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { message?: unknown } | undefined;
    const message = Array.isArray(data?.message)
      ? data.message.filter((item) => typeof item === 'string').join(', ')
      : typeof data?.message === 'string'
        ? data.message
        : fallback;
    return new Error(message);
  }
  return error instanceof Error
    ? new Error(error.message)
    : new Error(fallback);
}

class KeyManagementService {
  async getTargets(): Promise<KeyManagementTarget[]> {
    try {
      const { data } = await api.get<KeyManagementTarget[]>(
        '/key-management/targets',
      );
      return data;
    } catch (error) {
      throw toSafeError(error, '운영 키 대상을 불러오지 못했습니다.');
    }
  }

  async reveal(targetId: string): Promise<RevealedEnvironment> {
    try {
      const { data } = await api.post<RevealedEnvironment>(
        `/key-management/targets/${targetId}/reveal`,
      );
      return data;
    } catch (error) {
      // AxiosError 자체를 출력하면 요청 config에 민감한 body가 포함될 수 있다.
      throw toSafeError(error, '운영 환경 변수를 공개하지 못했습니다.');
    }
  }

  async update(
    targetId: string,
    envFile: string,
    expectedVersion: string,
  ): Promise<EnvironmentMutation> {
    try {
      const { data } = await api.put<EnvironmentMutation>(
        `/key-management/targets/${targetId}/environment`,
        { envFile, expectedVersion },
      );
      return data;
    } catch (error) {
      throw toSafeError(error, '운영 환경 변수 변경에 실패했습니다.');
    }
  }

  async getBackups(targetId: string): Promise<SecretBackup[]> {
    try {
      const { data } = await api.get<SecretBackup[]>(
        `/key-management/targets/${targetId}/backups?limit=30`,
      );
      return data;
    } catch (error) {
      throw toSafeError(error, '백업 및 배포 이력을 불러오지 못했습니다.');
    }
  }

  async restore(
    targetId: string,
    backupId: string,
    expectedVersion: string,
  ): Promise<EnvironmentMutation> {
    try {
      const { data } = await api.post<EnvironmentMutation>(
        `/key-management/targets/${targetId}/backups/${backupId}/restore`,
        { expectedVersion },
      );
      return data;
    } catch (error) {
      throw toSafeError(error, '백업 복원에 실패했습니다.');
    }
  }

  async retryDeployment(targetId: string, backupId: string) {
    try {
      const { data } = await api.post<{
        requestId: string;
        state: 'queued';
        version: string;
      }>(
        `/key-management/targets/${targetId}/backups/${backupId}/retry-deployment`,
      );
      return data;
    } catch (error) {
      throw toSafeError(error, '배포 재시도에 실패했습니다.');
    }
  }
}

export const keyManagementService = new KeyManagementService();
