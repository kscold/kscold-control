import { api } from '@/shared/api/client';
import { BaseApiService } from '@/shared/api/base.service';
import type {
  AutomationsOverview,
  DockerDiskTrimResult,
  StorageOverview,
} from '../model/maintenance.types';

/** 저장공간 현황 API */
export class StorageService extends BaseApiService {
  private readonly basePath = '/maintenance/storage';

  /** 처음 잴 때는 폴더 크기 때문에 수십 초 걸릴 수 있다. */
  async getOverview(refresh = false): Promise<StorageOverview> {
    try {
      return (
        await api.get<StorageOverview>(this.basePath, {
          params: refresh ? { refresh: true } : undefined,
          timeout: 180_000,
        })
      ).data;
    } catch (error) {
      this.handleError(error, '저장공간 현황 조회 실패');
    }
  }

  /** 맥 자동 실행 작업과 컨테이너 안 폴더를 읽느라 몇 초 걸릴 수 있다. */
  async getAutomations(): Promise<AutomationsOverview> {
    try {
      return (
        await api.get<AutomationsOverview>('/maintenance/automations', {
          timeout: 120_000,
        })
      ).data;
    } catch (error) {
      this.handleError(error, '자동 작업 현황 조회 실패');
    }
  }

  async trimDockerDisk(): Promise<DockerDiskTrimResult> {
    try {
      return (
        await api.post<DockerDiskTrimResult>(
          `${this.basePath}/docker-disk/trim`,
          undefined,
          { timeout: 200_000 },
        )
      ).data;
    } catch (error) {
      this.handleError(error, '공간 반환 실패');
    }
  }
}

export const storageService = new StorageService();
