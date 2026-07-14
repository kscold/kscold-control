import { Injectable } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { WorkspaceGitService } from '../services/workspace-git.service';
import type { WorkspaceFileResult } from '../../domain/types/workspace-file.type';

/** 워크스페이스 파일 쓰기 */
@Injectable()
export class WriteWorkspaceFileUseCase {
  constructor(private readonly workspaceGit: WorkspaceGitService) {}

  async execute(
    filePath: string,
    content: string,
  ): Promise<WorkspaceFileResult> {
    const resolvedPath = this.workspaceGit.resolveWorkspacePath(filePath);
    await this.workspaceGit.assertWorkspacePath(resolvedPath);
    const { absolutePath, relativePath } = resolvedPath;

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, 'utf8');

    const [buffer, stats] = await Promise.all([
      fs.readFile(absolutePath),
      fs.stat(absolutePath),
    ]);

    return this.workspaceGit.toWorkspaceFileResult(
      absolutePath,
      relativePath,
      buffer,
      stats.mtime,
    );
  }
}
