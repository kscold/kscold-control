import { api } from '@/shared/api/client';
import { BaseApiService } from '@/shared/api/base.service';
import type {
  BackupOverview,
  BackupRun,
  BackupTarget,
  CreateBackupTargetInput,
  ListBackupRunsParams,
  UpdateBackupTargetInput,
} from '../model/backup.types';

/** 백업 관리 API */
export class BackupTargetService extends BaseApiService {
  private readonly basePath = '/backups';

  async getOverview(): Promise<BackupOverview> {
    try {
      const { data } = await api.get<BackupOverview>(
        `${this.basePath}/targets`,
      );
      return data;
    } catch (error) {
      this.logError('BackupTargetService', 'getOverview', error);
      this.handleError(error, '백업 현황 조회 실패');
    }
  }

  async createTarget(input: CreateBackupTargetInput): Promise<BackupTarget> {
    try {
      const { data } = await api.post<BackupTarget>(
        `${this.basePath}/targets`,
        input,
      );
      return data;
    } catch (error) {
      // 요청 본문에 접속 URI 가 있어 오류 객체를 콘솔에 남기지 않는다.
      this.handleError(error, '백업 대상 등록 실패');
    }
  }

  async updateTarget(
    id: string,
    input: UpdateBackupTargetInput,
  ): Promise<BackupTarget> {
    try {
      const { data } = await api.patch<BackupTarget>(
        `${this.basePath}/targets/${id}`,
        input,
      );
      return data;
    } catch (error) {
      // 요청 본문에 접속 URI 가 있을 수 있어 오류 객체를 콘솔에 남기지 않는다.
      this.handleError(error, '백업 대상 수정 실패');
    }
  }

  async removeTarget(id: string): Promise<BackupTarget> {
    try {
      const { data } = await api.delete<BackupTarget>(
        `${this.basePath}/targets/${id}`,
      );
      return data;
    } catch (error) {
      this.logError('BackupTargetService', 'removeTarget', error);
      this.handleError(error, '백업 대상 삭제 실패');
    }
  }

  /** 백업을 시작한다. 덤프는 서버에서 이어지고, 시작한 실행 기록만 돌아온다. */
  async runTarget(id: string): Promise<BackupRun> {
    try {
      const { data } = await api.post<BackupRun>(
        `${this.basePath}/targets/${id}/run`,
      );
      return data;
    } catch (error) {
      this.logError('BackupTargetService', 'runTarget', error);
      this.handleError(error, '백업 실행 실패');
    }
  }

  async listRuns(params: ListBackupRunsParams = {}): Promise<BackupRun[]> {
    try {
      const { data } = await api.get<{ items: BackupRun[] }>(
        `${this.basePath}/runs`,
        { params },
      );
      return data.items;
    } catch (error) {
      this.logError('BackupTargetService', 'listRuns', error);
      this.handleError(error, '백업 실행 이력 조회 실패');
    }
  }
}

export const backupTargetService = new BackupTargetService();
