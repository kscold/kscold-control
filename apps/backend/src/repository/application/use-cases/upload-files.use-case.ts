import { randomUUID } from 'crypto';
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
import {
  assertNoPrivateKeyMaterial,
  assertSafeRepositoryPath,
} from '../utils/repository-path.util';
import { hashUploadBuffer } from '../utils/upload-manifest.util';

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
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: IProjectRepository,
    @Inject(FILE_STORAGE)
    private readonly fileStorage: IFileStorage,
    private readonly uploadCoordinator: RepositoryUploadCoordinator,
  ) {}

  async execute(
    projectId: string,
    files: UploadFile[],
    replace: boolean,
    ownerId?: string,
  ): Promise<UploadResult> {
    return this.uploadCoordinator.runExclusive(projectId, async () => {
      const project = await this.projectRepository.findById(projectId, ownerId);
      if (!project) {
        throw new NotFoundException(
          `프로젝트를 찾을 수 없습니다: ${projectId}`,
        );
      }
      if (!files?.length) {
        throw new BadRequestException('업로드할 파일이 없습니다.');
      }

      const expected = new Map<string, { size: number; sha256: string }>();
      for (const file of files) {
        assertSafeRepositoryPath(file.relativePath);
        assertNoPrivateKeyMaterial(file.relativePath, file.buffer);
        if (
          file.size !== file.buffer.length ||
          expected.has(file.relativePath)
        ) {
          throw new BadRequestException(
            `중복되거나 크기가 잘못된 파일입니다: ${file.relativePath}`,
          );
        }
        expected.set(file.relativePath, {
          size: file.size,
          sha256: hashUploadBuffer(file.buffer),
        });
      }

      const sessionId = randomUUID();
      await this.fileStorage.prepareStagedUpload(
        project.name,
        sessionId,
        replace,
      );
      try {
        for (const file of files) {
          await this.fileStorage.writeStagedFile(
            project.name,
            sessionId,
            file.relativePath,
            file.buffer,
          );
        }

        const inspection = await this.fileStorage.inspectStagedUpload(
          project.name,
          sessionId,
        );
        const actual = new Map(
          inspection.files.map((file) => [file.relativePath, file]),
        );
        for (const [relativePath, metadata] of expected) {
          const staged = actual.get(relativePath);
          if (
            !staged ||
            staged.size !== metadata.size ||
            staged.sha256 !== metadata.sha256
          ) {
            throw new BadRequestException(
              `업로드 파일 무결성 검증에 실패했습니다: ${relativePath}`,
            );
          }
        }
        if (replace && actual.size !== expected.size) {
          throw new BadRequestException(
            '선언되지 않은 파일이 포함되어 업로드를 중단했습니다.',
          );
        }

        const finalized = await this.fileStorage.finalizeStagedUpload(
          project.name,
          sessionId,
        );
        const updated = await this.projectRepository.update(projectId, {
          fileCount: finalized.stats.fileCount,
          totalSize: finalized.stats.totalSize,
        });
        return {
          project: updated,
          uploadedCount: files.length,
          totalBytes: files.reduce((sum, file) => sum + file.size, 0),
        };
      } catch (error) {
        await this.fileStorage.discardStagedUpload(project.name, sessionId);
        throw error;
      }
    });
  }
}
