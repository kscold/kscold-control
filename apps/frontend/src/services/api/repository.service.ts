import { api } from '../../lib/api';
import { BaseApiService } from './base.service';
import type {
  RepositoryProject,
  FileTreeNode,
  UploadResult,
  CreateProjectInput,
  ClientFile,
  FileContentResult,
  CreateUploadSessionInput,
  RepositoryUploadSession,
  UploadSessionBatchResult,
} from '../../features/repository/lib/repository.types';

/**
 * Repository API Service — 소스 저장소 관리
 */
export class RepositoryService extends BaseApiService {
  private readonly basePath = '/repository';

  async listProjects(): Promise<RepositoryProject[]> {
    try {
      const { data } = await api.get<{ items: RepositoryProject[] }>(
        `${this.basePath}/projects`,
      );
      return data.items;
    } catch (error) {
      this.logError('RepositoryService', 'listProjects', error);
      this.handleError(error, '저장소 목록 조회 실패');
    }
  }

  async createProject(input: CreateProjectInput): Promise<RepositoryProject> {
    try {
      const { data } = await api.post<RepositoryProject>(
        `${this.basePath}/projects`,
        input,
      );
      return data;
    } catch (error) {
      this.logError('RepositoryService', 'createProject', error);
      this.handleError(error, '프로젝트 생성 실패');
    }
  }

  async deleteProject(id: string): Promise<void> {
    try {
      await api.delete(`${this.basePath}/projects/${id}`);
    } catch (error) {
      this.logError('RepositoryService', 'deleteProject', error);
      this.handleError(error, '프로젝트 삭제 실패');
    }
  }

  async uploadFiles(
    projectId: string,
    files: ClientFile[],
    options: { replace: boolean; onProgress?: (percent: number) => void },
  ): Promise<UploadResult> {
    try {
      const formData = new FormData();
      const relativePaths: string[] = [];

      for (const cf of files) {
        formData.append('files', cf.file, cf.file.name);
        relativePaths.push(cf.relativePath);
      }
      formData.append('relativePaths', JSON.stringify(relativePaths));

      const { data } = await api.post<UploadResult>(
        `${this.basePath}/projects/${projectId}/upload?replace=${options.replace}`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            if (!options.onProgress) {
              return;
            }

            const ratio =
              typeof e.progress === 'number'
                ? e.progress
                : e.total
                  ? e.loaded / e.total
                  : null;

            if (ratio !== null) {
              options.onProgress(Math.round(ratio * 100));
            }
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        },
      );
      return data;
    } catch (error) {
      this.logError('RepositoryService', 'uploadFiles', error);
      this.handleError(error, '업로드 실패');
    }
  }

  async createUploadSession(
    projectId: string,
    input: CreateUploadSessionInput,
  ): Promise<RepositoryUploadSession> {
    try {
      const { data } = await api.post<RepositoryUploadSession>(
        `${this.basePath}/projects/${projectId}/upload-sessions`,
        input,
      );
      return data;
    } catch (error) {
      this.logError('RepositoryService', 'createUploadSession', error);
      this.handleError(error, '업로드 세션 생성 실패');
    }
  }

  async getLatestUploadSession(
    projectId: string,
  ): Promise<RepositoryUploadSession | null> {
    try {
      const { data } = await api.get<{ item: RepositoryUploadSession | null }>(
        `${this.basePath}/projects/${projectId}/upload-sessions/latest`,
      );
      return data.item ?? null;
    } catch (error) {
      this.logError('RepositoryService', 'getLatestUploadSession', error);
      this.handleError(error, '업로드 세션 조회 실패');
    }
  }

  async getUploadSession(
    projectId: string,
    sessionId: string,
  ): Promise<RepositoryUploadSession | null> {
    try {
      const { data } = await api.get<{ item: RepositoryUploadSession | null }>(
        `${this.basePath}/projects/${projectId}/upload-sessions/${sessionId}`,
      );
      return data.item ?? null;
    } catch (error) {
      this.logError('RepositoryService', 'getUploadSession', error);
      this.handleError(error, '업로드 세션 상태 조회 실패');
    }
  }

  async uploadSessionBatch(
    projectId: string,
    sessionId: string,
    batchIndex: number,
    files: ClientFile[],
    options?: { onProgress?: (percent: number) => void },
  ): Promise<UploadSessionBatchResult> {
    try {
      const formData = new FormData();
      const relativePaths: string[] = [];

      for (const cf of files) {
        formData.append('files', cf.file, cf.file.name);
        relativePaths.push(cf.relativePath);
      }
      formData.append('relativePaths', JSON.stringify(relativePaths));

      const { data } = await api.post<UploadSessionBatchResult>(
        `${this.basePath}/projects/${projectId}/upload-sessions/${sessionId}/batches/${batchIndex}`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            if (!options?.onProgress) {
              return;
            }

            const ratio =
              typeof e.progress === 'number'
                ? e.progress
                : e.total
                  ? e.loaded / e.total
                  : null;

            if (ratio !== null) {
              options.onProgress(Math.round(ratio * 100));
            }
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        },
      );

      return data;
    } catch (error) {
      this.logError('RepositoryService', 'uploadSessionBatch', error);
      this.handleError(error, '업로드 배치 전송 실패');
    }
  }

  async getTree(projectId: string): Promise<FileTreeNode> {
    try {
      const { data } = await api.get<FileTreeNode>(
        `${this.basePath}/projects/${projectId}/tree`,
      );
      return data;
    } catch (error) {
      this.logError('RepositoryService', 'getTree', error);
      this.handleError(error, '파일 트리 조회 실패');
    }
  }

  async readFile(projectId: string, path: string): Promise<FileContentResult> {
    try {
      const { data } = await api.get<FileContentResult>(
        `${this.basePath}/projects/${projectId}/file`,
        { params: { path } },
      );
      return data;
    } catch (error) {
      this.logError('RepositoryService', 'readFile', error);
      this.handleError(error, '파일 내용 조회 실패');
    }
  }

  /** 다운로드 URL — `<a href>` 또는 `window.location` 으로 사용 */
  getDownloadUrl(projectId: string): string {
    return `${api.defaults.baseURL ?? ''}${this.basePath}/projects/${projectId}/download`;
  }
}

export const repositoryService = new RepositoryService();
