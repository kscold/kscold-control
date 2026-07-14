import { Injectable } from '@nestjs/common';
import path from 'node:path';
import { WorkspaceGitService } from '../services/workspace-git.service';
import type { WorkspaceTreeResult } from '../../domain/types/workspace-file.type';

/** 워크스페이스 파일 트리 + 변경사항 조회 */
@Injectable()
export class ReadWorkspaceTreeUseCase {
  constructor(private readonly workspaceGit: WorkspaceGitService) {}

  async execute(): Promise<WorkspaceTreeResult> {
    const workspaceRoot = this.workspaceGit.getWorkspaceRoot();
    const gitContext = await this.workspaceGit.resolveGitContext();
    const changes = await this.workspaceGit.listGitChanges(
      workspaceRoot,
      gitContext,
    );
    const changeMap = new Map(changes.map((change) => [change.path, change]));
    const children = await this.workspaceGit.buildWorkspaceTree(
      workspaceRoot,
      '',
      changeMap,
    );
    const ship = await this.workspaceGit.buildShipStatus(gitContext, changes);

    return {
      root: {
        name: path.basename(workspaceRoot),
        path: '.',
        type: 'directory',
        children,
        changed: children.some((child) => child.changed),
        reviewState: this.workspaceGit.getDirectoryReviewState(children),
      },
      changes,
      git: {
        enabled: gitContext.enabled,
        rootPath: gitContext.repoRoot,
        branch: gitContext.branch,
      },
      ship,
    };
  }
}
