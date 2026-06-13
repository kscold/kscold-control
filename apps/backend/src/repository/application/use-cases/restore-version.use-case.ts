import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FILE_STORAGE,
  IFileStorage,
} from '../../domain/repositories/file-storage.interface';
import {
  IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../domain/repositories/project.repository.interface';
import { Project } from '../../domain/entities/project.entity';

@Injectable()
export class RestoreVersionUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: IProjectRepository,
    @Inject(FILE_STORAGE)
    private readonly fileStorage: IFileStorage,
  ) {}

  async execute(projectId: string, versionId: string): Promise<Project> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException(`프로젝트를 찾을 수 없습니다: ${projectId}`);
    }
    if (!versionId) {
      throw new BadRequestException('versionId가 필요합니다');
    }

    // 복원 전에 현재 상태를 스냅샷으로 백업한다.
    // 잘못 되돌렸을 때 다시 원복할 수 있도록 안전장치를 둔다.
    await this.fileStorage.createSnapshot(project.name).catch(() => undefined);

    await this.fileStorage.restoreVersion(project.name, versionId);

    const stats = await this.fileStorage.getStats(project.name);
    return this.projectRepository.update(projectId, {
      fileCount: stats.fileCount,
      totalSize: stats.totalSize,
    });
  }
}
