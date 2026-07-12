import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Readable } from 'stream';
import {
  IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../domain/repositories/project.repository.interface';
import {
  FILE_STORAGE,
  IFileStorage,
} from '../../domain/repositories/file-storage.interface';

export interface ArchiveResult {
  filename: string;
  stream: Readable;
}

@Injectable()
export class DownloadArchiveUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: IProjectRepository,
    @Inject(FILE_STORAGE)
    private readonly fileStorage: IFileStorage,
  ) {}

  async execute(projectId: string, ownerId?: string): Promise<ArchiveResult> {
    const project = await this.projectRepository.findById(projectId, ownerId);
    if (!project) {
      throw new NotFoundException(`프로젝트를 찾을 수 없습니다: ${projectId}`);
    }

    const stream = await this.fileStorage.archiveProject(project.name);
    const ts = new Date().toISOString().slice(0, 10);
    return {
      filename: `${project.name}_${ts}.tar.gz`,
      stream,
    };
  }
}
