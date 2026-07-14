import { BadRequestException, Injectable } from '@nestjs/common';
import { WorkspaceGitService } from '../services/workspace-git.service';
import type { WorkspaceCommitResult } from '../../domain/types/workspace-file.type';

/** 워크스페이스 staged 변경 커밋 */
@Injectable()
export class CommitWorkspaceChangesUseCase {
  constructor(private readonly workspaceGit: WorkspaceGitService) {}

  async execute(message: string): Promise<WorkspaceCommitResult> {
    const commitMessage = message.trim();
    if (!commitMessage) {
      throw new BadRequestException('커밋 메시지를 입력해주세요.');
    }

    const workspaceRoot = this.workspaceGit.getWorkspaceRoot();
    const gitContext = await this.workspaceGit.resolveGitContext();

    if (!gitContext.enabled || !gitContext.repoRoot) {
      throw new BadRequestException('Git 작업공간에서만 커밋할 수 있습니다.');
    }

    const changes = await this.workspaceGit.listGitChanges(
      workspaceRoot,
      gitContext,
    );
    const stagedCount = changes.filter((change) => change.staged).length;
    if (stagedCount === 0) {
      throw new BadRequestException(
        '커밋할 staged 변경이 없습니다. accept로 먼저 스테이징해주세요.',
      );
    }

    try {
      await this.workspaceGit.runGitCommand(
        ['commit', '-m', commitMessage],
        gitContext.repoRoot,
      );
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : '커밋에 실패했습니다. Git 설정을 확인해주세요.',
      );
    }

    const [headResult, remoteUrl, defaultBaseBranch] = await Promise.all([
      this.workspaceGit.runGitCommand(
        ['rev-parse', 'HEAD'],
        gitContext.repoRoot,
      ),
      this.workspaceGit.resolveRemoteUrl(gitContext),
      this.workspaceGit.resolveDefaultBaseBranch(gitContext),
    ]);

    return {
      ok: true,
      commitSha: headResult.stdout.trim(),
      commitMessage,
      branch: gitContext.branch,
      compareUrl: this.workspaceGit.buildCompareUrl(
        remoteUrl,
        defaultBaseBranch,
        gitContext.branch,
      ),
    };
  }
}
