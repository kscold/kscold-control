import { Injectable } from '@nestjs/common';
import { WorkspaceGitService } from '../services/workspace-git.service';
import type { WorkspaceDiffResult } from '../../domain/types/workspace-file.type';

/** 워크스페이스 파일 diff 조회 */
@Injectable()
export class ReadWorkspaceDiffUseCase {
  constructor(private readonly workspaceGit: WorkspaceGitService) {}

  async execute(filePath: string): Promise<WorkspaceDiffResult> {
    const resolvedPath = this.workspaceGit.resolveWorkspacePath(filePath);
    await this.workspaceGit.assertWorkspacePath(resolvedPath);
    const gitContext = await this.workspaceGit.resolveGitContext();

    if (!gitContext.enabled) {
      return {
        path: resolvedPath.relativePath,
        absolutePath: resolvedPath.absolutePath,
        gitEnabled: false,
        changeKind: null,
        reviewState: 'clean',
        staged: false,
        unstaged: false,
        diff: '',
        hunks: [],
        canAccept: false,
        canReject: false,
      };
    }

    const changes = await this.workspaceGit.listGitChanges(
      this.workspaceGit.getWorkspaceRoot(),
      gitContext,
    );
    const change = changes.find(
      (item) => item.path === resolvedPath.relativePath,
    );

    if (!change) {
      return {
        path: resolvedPath.relativePath,
        absolutePath: resolvedPath.absolutePath,
        gitEnabled: true,
        changeKind: null,
        reviewState: 'clean',
        staged: false,
        unstaged: false,
        diff: '',
        hunks: [],
        canAccept: false,
        canReject: false,
      };
    }

    const [diff, actionDiff] = await Promise.all([
      this.workspaceGit.resolveDiffForChange(resolvedPath, change, gitContext),
      this.workspaceGit.resolveActionDiffForChange(
        resolvedPath,
        change,
        gitContext,
      ),
    ]);

    return {
      path: resolvedPath.relativePath,
      absolutePath: resolvedPath.absolutePath,
      gitEnabled: true,
      changeKind: change.kind,
      reviewState: change.reviewState,
      staged: change.staged,
      unstaged: change.unstaged,
      diff,
      hunks: this.workspaceGit
        .parseDiffHunks(actionDiff)
        .map(({ patch: _patch, ...hunk }) => hunk),
      canAccept: true,
      canReject: true,
    };
  }
}
