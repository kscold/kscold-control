import { api } from '../../lib/api';
import { BaseApiService } from './base.service';
import type {
  RepositoryProject,
  FileTreeNode,
  UploadResult,
  CreateProjectInput,
  ClientFile,
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
            if (e.total && options.onProgress) {
              options.onProgress(Math.round((e.loaded / e.total) * 100));
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

  /** 다운로드 URL — `<a href>` 또는 `window.location` 으로 사용 */
  getDownloadUrl(projectId: string): string {
    return `${api.defaults.baseURL ?? ''}${this.basePath}/projects/${projectId}/download`;
  }
}

export const repositoryService = new RepositoryService();
