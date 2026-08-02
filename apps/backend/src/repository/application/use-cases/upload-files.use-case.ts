import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../domain/repositories/project.repository.interface';
import {
  FILE_STORAGE,
  IFileStorage,
} from '../../domain/repositories/file-storage.interface';
import { Project } from '../../domain/entities/project.entity';
import { assertSafeRepositoryPath } from '../utils/repository-path.util';

export interface UploadFile {
  relativePath: string;
  buffer: Buffer;
  size: number;
}

export interface UploadResult {
  project: Project;
  uploadedCount: number;
  totalBytes: number;
}

@Injectable()
export class UploadFilesUseCase {
  private readonly logger = new Logger(UploadFilesUseCase.name);

  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: IProjectRepository,
    @Inject(FILE_STORAGE)
    private readonly fileStorage: IFileStorage,
  ) {}

  async execute(
    projectId: string,
    files: UploadFile[],
    replace: boolean,
    ownerId?: string,
  ): Promise<UploadResult> {
    const project = await this.projectRepository.findById(projectId, ownerId);
    if (!project) {
      throw new NotFoundException(`프로젝트를 찾을 수 없습니다: ${projectId}`);
    }

    if (!files || files.length === 0) {
      throw new BadRequestException('업로드할 파일이 없습니다');
    }

    if (replace) {
      // 콘텐츠만 비우고 .versions 히스토리는 보존 (버전 누적 유지)
      await this.fileStorage.clearProjectFiles(project.name);
      await this.fileStorage.ensureProject(project.name);
    } else {
      await this.fileStorage.ensureProject(project.name);
    }

    let totalBytes = 0;
    for (const file of files) {
      this.assertSafePath(file.relativePath);
      await this.fileStorage.writeFile(
        project.name,
        file.relativePath,
        file.buffer,
      );
      totalBytes += file.size;
    }

    const stats = await this.fileStorage.getStats(project.name);
    const updated = await this.projectRepository.update(projectId, {
      fileCount: stats.fileCount,
      totalSize: stats.totalSize,
    });

    // 업로드 완료 시점을 하나의 버전으로 스냅샷 남긴다.
    // 스냅샷 실패가 업로드 자체를 되돌릴 이유는 없지만, 조용히 넘어가면
    // 사용자는 성공으로 알고 있는데 되돌릴 버전이 없는 상태가 되므로 반드시 기록한다.
    this.fileStorage.createSnapshot(project.name).catch((error: Error) => {
      this.logger.warn(
        `업로드 후 스냅샷 생성 실패 (업로드 자체는 완료됨): ${project.name} — ${error.message}`,
      );
    });

    return {
      project: updated,
      uploadedCount: files.length,
      totalBytes,
    };
  }

  private assertSafePath(relativePath: string): void {
    assertSafeRepositoryPath(relativePath);
  }
}
