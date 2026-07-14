import { BadRequestException, Injectable } from '@nestjs/common';
import { WorkspaceGitService } from '../services/workspace-git.service';
import type { WorkspaceBranchResult } from '../../domain/types/workspace-file.type';

/** 워크스페이스 브랜치 생성 */
@Injectable()
export class CreateWorkspaceBranchUseCase {
  constructor(private readonly workspaceGit: WorkspaceGitService) {}

  async execute(branchName: string): Promise<WorkspaceBranchResult> {
    const nextBranchName = this.workspaceGit.sanitizeBranchName(branchName);
    const gitContext = await this.workspaceGit.resolveGitContext();

    if (!gitContext.enabled || !gitContext.repoRoot) {
      throw new BadRequestException(
        'Git 작업공간에서만 브랜치를 만들 수 있습니다.',
      );
    }

    await this.workspaceGit.assertValidBranchName(nextBranchName, gitContext);

    const existingBranch = await this.workspaceGit.runGitCommand(
      ['show-ref', '--verify', '--quiet', `refs/heads/${nextBranchName}`],
      gitContext.repoRoot,
      [0, 1],
    );
    if (existingBranch.code === 0) {
      throw new BadRequestException('이미 존재하는 브랜치 이름입니다.');
    }

    const startPoint =
      gitContext.branch ||
      (await this.workspaceGit.resolveDefaultBaseBranch(gitContext)) ||
      'HEAD';

    await this.workspaceGit.runGitCommand(
      ['checkout', '-b', nextBranchName, startPoint],
      gitContext.repoRoot,
    );

    const remoteUrl = await this.workspaceGit.resolveRemoteUrl({
      ...gitContext,
      branch: nextBranchName,
    });
    const defaultBaseBranch =
      await this.workspaceGit.resolveDefaultBaseBranch(gitContext);

    return {
      ok: true,
      branch: nextBranchName,
      compareUrl: this.workspaceGit.buildCompareUrl(
        remoteUrl,
        defaultBaseBranch,
        nextBranchName,
      ),
    };
  }
}
