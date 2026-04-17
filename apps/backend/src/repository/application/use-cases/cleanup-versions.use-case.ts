import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  FILE_STORAGE,
  IFileStorage,
} from '../../domain/repositories/file-storage.interface';
import {
  IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../domain/repositories/project.repository.interface';

@Injectable()
export class CleanupVersionsUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: IProjectRepository,
    @Inject(FILE_STORAGE)
    private readonly fileStorage: IFileStorage,
  ) {}

  async execute(projectId: string, keepCount = 1): Promise<{ projectName: string; deleted: number }> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException(`프로젝트를 찾을 수 없습니다: ${projectId}`);
    }
    const deleted = await this.fileStorage.cleanupVersions(project.name, keepCount);
    return { projectName: project.name, deleted };
  }
}
