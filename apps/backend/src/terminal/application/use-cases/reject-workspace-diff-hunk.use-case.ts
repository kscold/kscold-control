import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WorkspaceGitService } from '../services/workspace-git.service';
import { ReadWorkspaceDiffUseCase } from './read-workspace-diff.use-case';
import type { WorkspaceDiffResult } from '../../domain/types/workspace-file.type';

/** 워크스페이스 diff hunk 단위 거절 (git apply -R) */
@Injectable()
export class RejectWorkspaceDiffHunkUseCase {
  constructor(
    private readonly workspaceGit: WorkspaceGitService,
    private readonly readWorkspaceDiff: ReadWorkspaceDiffUseCase,
  ) {}

  async execute(
    filePath: string,
    hunkIndex: number,
  ): Promise<WorkspaceDiffResult> {
    const resolvedPath = this.workspaceGit.resolveWorkspacePath(filePath);
    await this.workspaceGit.assertWorkspacePath(resolvedPath);
    const gitContext = await this.workspaceGit.resolveGitContext();

    if (!gitContext.enabled || !gitContext.repoRoot) {
      throw new BadRequestException(
        'Git 작업공간에서만 hunk 리뷰를 지원합니다.',
      );
    }

    const changes = await this.workspaceGit.listGitChanges(
      this.workspaceGit.getWorkspaceRoot(),
      gitContext,
    );
    const change = changes.find(
      (item) => item.path === resolvedPath.relativePath,
    );

    if (!change) {
      throw new NotFoundException('변경된 파일을 찾지 못했습니다.');
    }

    const hunk = await this.workspaceGit.resolveHunkPatch(
      resolvedPath,
      change,
      gitContext,
      hunkIndex,
    );

    try {
      await this.workspaceGit.applyGitPatch(
        ['apply', '-R', '--whitespace=nowarn', '--recount'],
        gitContext.repoRoot,
        hunk.patch,
      );
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : '선택한 hunk를 되돌리지 못했습니다.',
      );
    }

    return this.readWorkspaceDiff.execute(filePath);
  }
}
