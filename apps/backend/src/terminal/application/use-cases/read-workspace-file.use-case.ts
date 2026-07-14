import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { WorkspaceGitService } from '../services/workspace-git.service';
import type { WorkspaceFileResult } from '../../domain/types/workspace-file.type';

/** 워크스페이스 파일 읽기 */
@Injectable()
export class ReadWorkspaceFileUseCase {
  constructor(private readonly workspaceGit: WorkspaceGitService) {}

  async execute(filePath: string): Promise<WorkspaceFileResult> {
    const resolvedPath = this.workspaceGit.resolveWorkspacePath(filePath);
    await this.workspaceGit.assertWorkspacePath(resolvedPath);
    const { absolutePath, relativePath } = resolvedPath;

    try {
      const [buffer, stats] = await Promise.all([
        fs.readFile(absolutePath),
        fs.stat(absolutePath),
      ]);

      if (!stats.isFile()) {
        throw new NotFoundException('파일이 아닙니다.');
      }

      return this.workspaceGit.toWorkspaceFileResult(
        absolutePath,
        relativePath,
        buffer,
        stats.mtime,
      );
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new NotFoundException('파일을 찾을 수 없습니다.');
    }
  }
}
