import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  FILE_STORAGE,
  IFileStorage,
  ProjectVersion,
} from '../../domain/repositories/file-storage.interface';
import {
  IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../domain/repositories/project.repository.interface';

@Injectable()
export class ListVersionsUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: IProjectRepository,
    @Inject(FILE_STORAGE)
    private readonly fileStorage: IFileStorage,
  ) {}

  async execute(
    projectId: string,
    ownerId?: string,
  ): Promise<ProjectVersion[]> {
    const project = await this.projectRepository.findById(projectId, ownerId);
    if (!project) {
      throw new NotFoundException(`프로젝트를 찾을 수 없습니다: ${projectId}`);
    }
    return this.fileStorage.listVersions(project.name);
  }
}
