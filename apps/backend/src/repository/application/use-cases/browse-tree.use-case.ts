import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../domain/repositories/project.repository.interface';
import {
  FILE_STORAGE,
  FileTreeNode,
  IFileStorage,
} from '../../domain/repositories/file-storage.interface';

@Injectable()
export class BrowseTreeUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: IProjectRepository,
    @Inject(FILE_STORAGE)
    private readonly fileStorage: IFileStorage,
  ) {}

  async execute(projectId: string): Promise<FileTreeNode> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException(`프로젝트를 찾을 수 없습니다: ${projectId}`);
    }
    return this.fileStorage.listTree(project.name);
  }
}
