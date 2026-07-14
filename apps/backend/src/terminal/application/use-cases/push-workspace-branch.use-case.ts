import { BadRequestException, Injectable } from '@nestjs/common';
import { WorkspaceGitService } from '../services/workspace-git.service';
import type { WorkspacePushResult } from '../../domain/types/workspace-file.type';

/** 워크스페이스 현재 브랜치 push */
@Injectable()
export class PushWorkspaceBranchUseCase {
  constructor(private readonly workspaceGit: WorkspaceGitService) {}

  async execute(): Promise<WorkspacePushResult> {
    const gitContext = await this.workspaceGit.resolveGitContext();

    if (!gitContext.enabled || !gitContext.repoRoot || !gitContext.branch) {
      throw new BadRequestException('Push할 활성 브랜치를 찾지 못했습니다.');
    }

    const remoteUrl = await this.workspaceGit.resolveRemoteUrl(gitContext);
    if (!remoteUrl) {
      throw new BadRequestException(
        'origin 원격 저장소가 설정되지 않아 push할 수 없습니다.',
      );
    }

    try {
      await this.workspaceGit.runGitCommand(
        ['push', '-u', 'origin', gitContext.branch],
        gitContext.repoRoot,
      );
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : '원격 저장소로 push하지 못했습니다.',
      );
    }

    const [trackingBranch, defaultBaseBranch] = await Promise.all([
      this.workspaceGit.resolveTrackingBranch(gitContext),
      this.workspaceGit.resolveDefaultBaseBranch(gitContext),
    ]);

    return {
      ok: true,
      branch: gitContext.branch,
      trackingBranch,
      remoteUrl,
      compareUrl: this.workspaceGit.buildCompareUrl(
        remoteUrl,
        defaultBaseBranch,
        gitContext.branch,
      ),
    };
  }
}
