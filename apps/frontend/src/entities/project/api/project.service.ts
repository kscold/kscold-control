import axios from 'axios';
import { api } from '@/shared/api/client';
import { BaseApiService } from '@/shared/api/base.service';
import type {
  RepositoryProject,
  FileTreeNode,
  UploadResult,
  CreateProjectInput,
  ClientFile,
  FileContentResult,
  VersionedFileContentResult,
  CreateUploadSessionInput,
  RepositoryUploadSession,
  UploadSessionBatchResult,
  FinalizeUploadSessionResult,
  ProjectVersion,
} from '../model/types';

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

      // 전송 직전 메모리로 스냅샷 — 업로드 중 파일이 바뀌어도
      // ERR_UPLOAD_FILE_CHANGED 없이 전송된다. (uploadSessionBatch와 동일)
      for (const cf of files) {
        const snapshot = await cf.file.arrayBuffer();
        formData.append('files', new Blob([snapshot]), cf.file.name);
        relativePaths.push(cf.relativePath);
      }
      formData.append('relativePaths', JSON.stringify(relativePaths));

      const { data } = await api.post<UploadResult>(
        `${this.basePath}/projects/${projectId}/upload?replace=${options.replace}`,
        formData,
        {
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
    const url = `${this.basePath}/projects/${projectId}/upload-sessions/${sessionId}/batches/${batchIndex}`;
    // 대형 프로젝트는 배치 수십 개를 순차 전송한다. 한 배치가 일시적 네트워크
    // 단절/타임아웃으로 실패해도 전체 업로드가 멈추지 않도록 배치 단위로 재시도한다.
    // 배치 전송은 멱등이다(같은 파일 재기록, replace 는 서버에서 1회만 적용).
    const maxAttempts = 4;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      // FormData/파일 스트림은 한 번 전송되면 재사용이 불안정하므로 시도마다 새로 만든다.
      const formData = new FormData();
      const relativePaths: string[] = [];

      // 디스크의 File 객체를 그대로 첨부하면 브라우저가 "전송 시점"에 파일의
      // 수정시각·크기를 재검증한다. 업로드 도중 파일이 바뀌면(AI·dev 서버가
      // 소스를 계속 수정하는 환경) net::ERR_UPLOAD_FILE_CHANGED 로 전송을 거부한다.
      // → 전송 직전 메모리로 읽어 스냅샷(Blob)을 첨부하면 이후 디스크 변경과
      //   무관하게 그 배치는 전송된다. 시도/재선택마다 최신 내용으로 다시 읽으므로
      //   "같은 폴더 다시 선택 → 이어올리기"도 반복 가능하다.
      for (const cf of files) {
        const snapshot = await cf.file.arrayBuffer();
        formData.append('files', new Blob([snapshot]), cf.file.name);
        relativePaths.push(cf.relativePath);
      }
      formData.append('relativePaths', JSON.stringify(relativePaths));

      try {
        const { data } = await api.post<UploadSessionBatchResult>(
          url,
          formData,
          {
            // Content-Type 수동 설정 금지 — 브라우저가 boundary 포함한 multipart/form-data 자동 설정
            // 배치 1건당 2분 타임아웃 — 멈춘 연결을 빨리 실패 처리해 재시도로 넘긴다.
            timeout: 120_000,
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
        lastError = error;
        this.logError(
          'RepositoryService',
          `uploadSessionBatch(batch ${batchIndex}, attempt ${attempt}/${maxAttempts})`,
          error,
        );

        // 재시도 불가한 오류(4xx 등)이거나 마지막 시도면 즉시 중단한다.
        if (!this.isRetryableError(error) || attempt === maxAttempts) {
          break;
        }

        // 지수 백오프 + 지터: 약 1s → 2s → 4s. 진행률을 0으로 되돌려 재시도 중임을 표시.
        options?.onProgress?.(0);
        const backoffMs = Math.min(1000 * 2 ** (attempt - 1), 8000);
        const jitter = Math.floor(Math.random() * 400);
        await this.delay(backoffMs + jitter);
      }
    }

    this.handleError(lastError, '업로드 배치 전송 실패');
  }

  async finalizeUploadSession(
    projectId: string,
    sessionId: string,
  ): Promise<FinalizeUploadSessionResult> {
    try {
      const { data } = await api.post<FinalizeUploadSessionResult>(
        `${this.basePath}/projects/${projectId}/upload-sessions/${sessionId}/finalize`,
      );
      return data;
    } catch (error) {
      this.logError('RepositoryService', 'finalizeUploadSession', error);
      this.handleError(error, '업로드 최종 반영 실패');
    }
  }

  /** 일시적 전송 오류(네트워크 단절·타임아웃·5xx)만 재시도 대상으로 본다. 4xx 는 재시도 무의미. */
  private isRetryableError(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      // 응답이 없으면 네트워크 단절/타임아웃(ECONNABORTED 등) → 재시도
      if (!error.response) {
        return true;
      }
      const status = error.response.status;
      return (
        status === 408 || status === 425 || status === 429 || status >= 500
      );
    }
    // Axios 외 예외(코드 버그 등)는 재시도하지 않는다.
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

  async readFileAtVersion(
    projectId: string,
    path: string,
    versionId: string,
  ): Promise<VersionedFileContentResult> {
    try {
      const { data } = await api.get<VersionedFileContentResult>(
        `${this.basePath}/projects/${projectId}/file-at-version`,
        { params: { path, versionId } },
      );
      return data;
    } catch (error) {
      this.logError('RepositoryService', 'readFileAtVersion', error);
      this.handleError(error, '이전 버전 파일 조회 실패');
    }
  }

  async listVersions(projectId: string): Promise<ProjectVersion[]> {
    try {
      const { data } = await api.get<{ items: ProjectVersion[] }>(
        `${this.basePath}/projects/${projectId}/versions`,
      );
      return data.items;
    } catch (error) {
      this.logError('RepositoryService', 'listVersions', error);
      this.handleError(error, '버전 목록 조회 실패');
    }
  }

  async restoreVersion(
    projectId: string,
    versionId: string,
  ): Promise<RepositoryProject> {
    try {
      const { data } = await api.post<RepositoryProject>(
        `${this.basePath}/projects/${projectId}/versions/${encodeURIComponent(versionId)}/restore`,
      );
      return data;
    } catch (error) {
      this.logError('RepositoryService', 'restoreVersion', error);
      this.handleError(error, '이전 버전 복원 실패');
    }
  }

  async cleanupVersions(projectId: string): Promise<{ deleted: number }> {
    try {
      const { data } = await api.delete<{ deleted: number }>(
        `${this.basePath}/projects/${projectId}/versions/cleanup`,
      );
      return data;
    } catch (error) {
      this.logError('RepositoryService', 'cleanupVersions', error);
      this.handleError(error, '이전 버전 삭제 실패');
    }
  }

  async downloadArchive(projectId: string, filename?: string): Promise<void> {
    try {
      const { data, headers } = await api.get<Blob>(
        `${this.basePath}/projects/${projectId}/download`,
        { responseType: 'blob' },
      );

      const disposition = headers['content-disposition'] as string | undefined;
      let name = filename ?? 'archive.tar.gz';
      if (disposition) {
        const match = /filename="?([^"]+)"?/.exec(disposition);
        if (match) name = match[1];
      }

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      this.logError('RepositoryService', 'downloadArchive', error);
      this.handleError(error, '다운로드 실패');
    }
  }
}

export const repositoryService = new RepositoryService();
