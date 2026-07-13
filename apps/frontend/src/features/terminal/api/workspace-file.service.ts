import { api } from '@/shared/api/client';
import { BaseApiService } from '@/shared/api/base.service';
import type {
  WorkspaceBranchResult,
  WorkspaceCommitResult,
  WorkspaceDiffResult,
  WorkspaceFileRecord,
  WorkspacePushResult,
  WorkspaceTreeResult,
} from '../lib/terminal.types';

export class WorkspaceFileService extends BaseApiService {
  private readonly basePath = '/terminal';

  async readFile(filePath: string): Promise<WorkspaceFileRecord> {
    try {
      const { data } = await api.get<WorkspaceFileRecord>(
        `${this.basePath}/workspace-file`,
        {
          params: { path: filePath },
        },
      );
      return data;
    } catch (error) {
      this.logError('WorkspaceFileService', 'readFile', error);
      this.handleError(error, '워크스페이스 파일 조회 실패');
    }
  }

  async writeFile(
    filePath: string,
    content: string,
  ): Promise<WorkspaceFileRecord> {
    try {
      const { data } = await api.put<WorkspaceFileRecord>(
        `${this.basePath}/workspace-file`,
        {
          path: filePath,
          content,
        },
      );
      return data;
    } catch (error) {
      this.logError('WorkspaceFileService', 'writeFile', error);
      this.handleError(error, '워크스페이스 파일 저장 실패');
    }
  }

  async readTree(): Promise<WorkspaceTreeResult> {
    try {
      const { data } = await api.get<WorkspaceTreeResult>(
        `${this.basePath}/workspace-tree`,
      );
      return data;
    } catch (error) {
      this.logError('WorkspaceFileService', 'readTree', error);
      this.handleError(error, '워크스페이스 트리 조회 실패');
    }
  }

  async readDiff(filePath: string): Promise<WorkspaceDiffResult> {
    try {
      const { data } = await api.get<WorkspaceDiffResult>(
        `${this.basePath}/workspace-diff`,
        {
          params: { path: filePath },
        },
      );
      return data;
    } catch (error) {
      this.logError('WorkspaceFileService', 'readDiff', error);
      this.handleError(error, '워크스페이스 diff 조회 실패');
    }
  }

  async acceptDiff(filePath: string): Promise<WorkspaceDiffResult> {
    try {
      const { data } = await api.post<WorkspaceDiffResult>(
        `${this.basePath}/workspace-diff/accept`,
        { path: filePath },
      );
      return data;
    } catch (error) {
      this.logError('WorkspaceFileService', 'acceptDiff', error);
      this.handleError(error, '변경 수락 실패');
    }
  }

  async rejectDiff(filePath: string): Promise<WorkspaceDiffResult> {
    try {
      const { data } = await api.post<WorkspaceDiffResult>(
        `${this.basePath}/workspace-diff/reject`,
        { path: filePath },
      );
      return data;
    } catch (error) {
      this.logError('WorkspaceFileService', 'rejectDiff', error);
      this.handleError(error, '변경 되돌리기 실패');
    }
  }

  async acceptDiffHunk(
    filePath: string,
    hunkIndex: number,
  ): Promise<WorkspaceDiffResult> {
    try {
      const { data } = await api.post<WorkspaceDiffResult>(
        `${this.basePath}/workspace-diff/hunk/accept`,
        { path: filePath, hunkIndex },
      );
      return data;
    } catch (error) {
      this.logError('WorkspaceFileService', 'acceptDiffHunk', error);
      this.handleError(error, '선택한 hunk 스테이징 실패');
    }
  }

  async rejectDiffHunk(
    filePath: string,
    hunkIndex: number,
  ): Promise<WorkspaceDiffResult> {
    try {
      const { data } = await api.post<WorkspaceDiffResult>(
        `${this.basePath}/workspace-diff/hunk/reject`,
        { path: filePath, hunkIndex },
      );
      return data;
    } catch (error) {
      this.logError('WorkspaceFileService', 'rejectDiffHunk', error);
      this.handleError(error, '선택한 hunk 되돌리기 실패');
    }
  }

  async commitChanges(message: string): Promise<WorkspaceCommitResult> {
    try {
      const { data } = await api.post<WorkspaceCommitResult>(
        `${this.basePath}/workspace-commit`,
        { message },
      );
      return data;
    } catch (error) {
      this.logError('WorkspaceFileService', 'commitChanges', error);
      this.handleError(error, '커밋 실패');
    }
  }

  async createBranch(name: string): Promise<WorkspaceBranchResult> {
    try {
      const { data } = await api.post<WorkspaceBranchResult>(
        `${this.basePath}/workspace-branch`,
        { name },
      );
      return data;
    } catch (error) {
      this.logError('WorkspaceFileService', 'createBranch', error);
      this.handleError(error, '브랜치 생성 실패');
    }
  }

  async pushBranch(): Promise<WorkspacePushResult> {
    try {
      const { data } = await api.post<WorkspacePushResult>(
        `${this.basePath}/workspace-push`,
      );
      return data;
    } catch (error) {
      this.logError('WorkspaceFileService', 'pushBranch', error);
      this.handleError(error, '브랜치 push 실패');
    }
  }
}

export const workspaceFileService = new WorkspaceFileService();
