import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
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
  private readonly logger = new Logger(RestoreVersionUseCase.name);

  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: IProjectRepository,
    @Inject(FILE_STORAGE)
    private readonly fileStorage: IFileStorage,
  ) {}

  async execute(
    projectId: string,
    versionId: string,
    ownerId?: string,
  ): Promise<Project> {
    const project = await this.projectRepository.findById(projectId, ownerId);
    if (!project) {
      throw new NotFoundException(`프로젝트를 찾을 수 없습니다: ${projectId}`);
    }
    if (!versionId) {
      throw new BadRequestException('versionId가 필요합니다');
    }

    // 복원 전에 현재 상태를 스냅샷으로 백업한다.
    // 잘못 되돌렸을 때 다시 원복할 수 있도록 안전장치를 둔다.
    // 이 스냅샷이 실패하면 안전장치가 없는 상태로 복원이 진행되므로 반드시 기록한다.
    await this.fileStorage
      .createSnapshot(project.name)
      .catch((error: Error) => {
        this.logger.warn(
          `복원 전 스냅샷 생성 실패 (복원은 계속 진행됨): ${project.name} — ${error.message}`,
        );
      });

    await this.fileStorage.restoreVersion(project.name, versionId);

    const stats = await this.fileStorage.getStats(project.name);
    return this.projectRepository.update(projectId, {
      fileCount: stats.fileCount,
      totalSize: stats.totalSize,
    });
  }
}
