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
import { RepositoryUploadCoordinator } from '../services/repository-upload-coordinator.service';

@Injectable()
export class RestoreVersionUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: IProjectRepository,
    @Inject(FILE_STORAGE)
    private readonly fileStorage: IFileStorage,
    private readonly uploadCoordinator: RepositoryUploadCoordinator,
  ) {}

  async execute(
    projectId: string,
    versionId: string,
    ownerId?: string,
  ): Promise<Project> {
    return this.uploadCoordinator.runExclusive(projectId, async () => {
      const project = await this.projectRepository.findById(projectId, ownerId);
      if (!project) {
        throw new NotFoundException(
          `프로젝트를 찾을 수 없습니다: ${projectId}`,
        );
      }
      if (!versionId) {
        throw new BadRequestException('versionId가 필요합니다');
      }

      // 복원 전 백업과 대상 아카이브 검증이 모두 성공해야 라이브 파일을 교체한다.
      await this.fileStorage.createSnapshot(project.name);
      await this.fileStorage.restoreVersion(project.name, versionId);
      const stats = await this.fileStorage.getStats(project.name);
      return this.projectRepository.update(projectId, {
        fileCount: stats.fileCount,
        totalSize: stats.totalSize,
      });
    });
  }
}
