import { BadRequestException, Injectable } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { WorkspaceGitService } from '../services/workspace-git.service';
import { ReadWorkspaceDiffUseCase } from './read-workspace-diff.use-case';
import type { WorkspaceDiffResult } from '../../domain/types/workspace-file.type';

/** 워크스페이스 파일 변경 거절 (restore) */
@Injectable()
export class RejectWorkspaceDiffUseCase {
  constructor(
    private readonly workspaceGit: WorkspaceGitService,
    private readonly readWorkspaceDiff: ReadWorkspaceDiffUseCase,
  ) {}

  async execute(filePath: string): Promise<WorkspaceDiffResult> {
    const resolvedPath = this.workspaceGit.resolveWorkspacePath(filePath);
    await this.workspaceGit.assertWorkspacePath(resolvedPath);
    const gitContext = await this.workspaceGit.resolveGitContext();

    if (!gitContext.enabled || !gitContext.repoRoot) {
      throw new BadRequestException(
        'Git 작업공간에서만 변경 리뷰를 지원합니다.',
      );
    }

    const change = await this.readWorkspaceDiff.execute(filePath);
    const repoRelativePath = this.workspaceGit.toPosixPath(
      path.relative(gitContext.repoRoot, resolvedPath.absolutePath),
    );

    if (change.changeKind === 'untracked' || change.changeKind === 'added') {
      await this.workspaceGit.runGitCommand(
        ['rm', '--cached', '--force', '--', repoRelativePath],
        gitContext.repoRoot,
        [0, 128],
      );
      await fs.rm(resolvedPath.absolutePath, { force: true, recursive: true });
      return this.readWorkspaceDiff.execute(filePath);
    }

    await this.workspaceGit.runGitCommand(
      [
        'restore',
        '--source=HEAD',
        '--staged',
        '--worktree',
        '--',
        repoRelativePath,
      ],
      gitContext.repoRoot,
    );

    return this.readWorkspaceDiff.execute(filePath);
  }
}
