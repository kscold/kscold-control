import { api } from '@/shared/api/client';
import { BaseApiService } from '@/shared/api/base.service';
import type {
  UpdateWorktreeCleanupTargetInput,
  WorktreeCleanupOverview,
  WorktreeCleanupPreview,
  WorktreeCleanupRun,
  WorktreeCleanupTarget,
  WorktreeCleanupTargetInput,
} from '../model/maintenance.types';

/** 작업 폴더 정리 API */
export class WorktreeCleanupService extends BaseApiService {
  private readonly basePath = '/maintenance/worktree-cleanup';

  async getOverview(): Promise<WorktreeCleanupOverview> {
    try {
      return (
        await api.get<WorktreeCleanupOverview>(`${this.basePath}/targets`)
      ).data;
    } catch (error) {
      this.handleError(error, '작업 폴더 정리 현황 조회 실패');
    }
  }

  /** 폴더를 하나씩 살펴보므로 수십 초 걸릴 수 있다. */
  async preview(id: string): Promise<WorktreeCleanupPreview> {
    try {
      return (
        await api.get<WorktreeCleanupPreview>(
          `${this.basePath}/targets/${id}/preview`,
          {
            timeout: 300_000,
          },
        )
      ).data;
    } catch (error) {
      this.handleError(error, '정리 미리보기 실패');
    }
  }

  async createTarget(
    input: WorktreeCleanupTargetInput,
  ): Promise<WorktreeCleanupTarget> {
    try {
      return (
        await api.post<WorktreeCleanupTarget>(`${this.basePath}/targets`, input)
      ).data;
    } catch (error) {
      this.handleError(error, '정리 대상 등록 실패');
    }
  }

  async updateTarget(
    id: string,
    input: UpdateWorktreeCleanupTargetInput,
  ): Promise<WorktreeCleanupTarget> {
    try {
      return (
        await api.patch<WorktreeCleanupTarget>(
          `${this.basePath}/targets/${id}`,
          input,
        )
      ).data;
    } catch (error) {
      this.handleError(error, '정리 대상 수정 실패');
    }
  }

  async removeTarget(id: string): Promise<WorktreeCleanupTarget> {
    try {
      return (
        await api.delete<WorktreeCleanupTarget>(
          `${this.basePath}/targets/${id}`,
        )
      ).data;
    } catch (error) {
      this.handleError(error, '정리 대상 삭제 실패');
    }
  }

  async run(id: string): Promise<WorktreeCleanupRun> {
    try {
      return (
        await api.post<WorktreeCleanupRun>(`${this.basePath}/targets/${id}/run`)
      ).data;
    } catch (error) {
      this.handleError(error, '작업 폴더 정리 실행 실패');
    }
  }

  async listRuns(
    params: { targetId?: string; limit?: number } = {},
  ): Promise<WorktreeCleanupRun[]> {
    try {
      return (
        await api.get<{ items: WorktreeCleanupRun[] }>(
          `${this.basePath}/runs`,
          { params },
        )
      ).data.items;
    } catch (error) {
      this.handleError(error, '정리 이력 조회 실패');
    }
  }
}

export const worktreeCleanupService = new WorktreeCleanupService();
