import {
  BadRequestException,
  ConflictException,
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
import {
  IUploadSessionRepository,
  UPLOAD_SESSION_REPOSITORY,
} from '../../domain/repositories/upload-session.repository.interface';
import {
  REPOSITORY_UPLOAD_PROTOCOL_VERSION,
  RepositoryUploadBatch,
  RepositoryUploadSession,
} from '../../domain/types/upload-session.type';
import { Project } from '../../domain/entities/project.entity';
import { RepositoryUploadCoordinator } from '../services/repository-upload-coordinator.service';
import {
  assertNoPrivateKeyMaterial,
  assertSafeRepositoryPath,
} from '../utils/repository-path.util';
import { hashUploadBuffer } from '../utils/upload-manifest.util';

export interface UploadSessionBatchFile {
  relativePath: string;
  buffer: Buffer;
  size: number;
}

export interface UploadSessionBatchResult {
  project: Project;
  session: RepositoryUploadSession;
  batchIndex: number;
  uploadedCount: number;
  failedFiles: string[];
}

@Injectable()
export class UploadSessionBatchUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: IProjectRepository,
    @Inject(FILE_STORAGE)
    private readonly fileStorage: IFileStorage,
    @Inject(UPLOAD_SESSION_REPOSITORY)
    private readonly uploadSessionRepository: IUploadSessionRepository,
    private readonly uploadCoordinator: RepositoryUploadCoordinator,
  ) {}

  async execute(
    projectId: string,
    sessionId: string,
    batchIndex: number,
    files: UploadSessionBatchFile[],
    ownerId?: string,
  ): Promise<UploadSessionBatchResult> {
    return this.uploadCoordinator.runExclusive(projectId, async () => {
      const project = await this.projectRepository.findById(projectId, ownerId);
      if (!project) {
        throw new NotFoundException(
          `프로젝트를 찾을 수 없습니다: ${projectId}`,
        );
      }
      if (!Number.isInteger(batchIndex) || batchIndex < 0 || !files?.length) {
        throw new BadRequestException(
          '업로드할 배치 또는 배치 인덱스가 올바르지 않습니다.',
        );
      }

      const session = await this.uploadSessionRepository.findById(
        projectId,
        sessionId,
      );
      if (!session) {
        throw new NotFoundException(
          `업로드 세션을 찾을 수 없습니다: ${sessionId}`,
        );
      }
      this.assertSessionCanReceiveBatch(session, project.name);

      const batch = session.batches.find((item) => item.index === batchIndex);
      if (!batch) {
        throw new NotFoundException(
          `업로드 배치를 찾을 수 없습니다: ${batchIndex}`,
        );
      }
      if (batch.status === 'completed') {
        return this.toResult(project, session, batch);
      }

      const validationFailures = this.validateFiles(batch, files);
      if (validationFailures.length > 0) {
        await this.markBatchFailed(session, batch, validationFailures);
        throw new BadRequestException(
          `배치 파일 무결성 검증에 실패했습니다: ${validationFailures.join(', ')}`,
        );
      }

      await this.fileStorage.prepareStagedUpload(
        project.name,
        session.id,
        session.replace,
      );
      this.markBatchUploading(session, batch);
      await this.uploadSessionRepository.save(session);

      const failedFiles: string[] = [];
      let uploadedBytes = 0;
      for (const file of files) {
        try {
          await this.fileStorage.writeStagedFile(
            project.name,
            session.id,
            file.relativePath,
            file.buffer,
          );
          uploadedBytes += file.size;
        } catch {
          failedFiles.push(file.relativePath);
        }
      }

      if (failedFiles.length > 0) {
        await this.markBatchFailed(session, batch, failedFiles);
      } else {
        batch.status = 'completed';
        batch.uploadedCount = batch.totalFiles;
        batch.uploadedBytes = uploadedBytes;
        batch.failedFiles = [];
        batch.error = null;
        batch.updatedAt = new Date().toISOString();
        this.recalculateSession(session);
        await this.uploadSessionRepository.save(session);
      }

      return this.toResult(project, session, batch);
    });
  }

  private assertSessionCanReceiveBatch(
    session: RepositoryUploadSession,
    projectName: string,
  ): void {
    if (
      session.projectName !== projectName ||
      session.protocolVersion !== REPOSITORY_UPLOAD_PROTOCOL_VERSION
    ) {
      throw new ConflictException(
        '현재 업로드 세션은 더 이상 호환되지 않습니다. 새 세션을 시작해주세요.',
      );
    }
    if (session.status === 'superseded') {
      throw new ConflictException(
        '더 최신 업로드 세션이 있습니다. 폴더를 다시 선택해주세요.',
      );
    }
    if (session.status === 'completed') return;
    if (session.status === 'finalizing') {
      throw new ConflictException('이미 업로드 최종 반영이 진행 중입니다.');
    }
  }

  private validateFiles(
    batch: RepositoryUploadBatch,
    files: UploadSessionBatchFile[],
  ): string[] {
    const expected = new Map(
      batch.files.map((file) => [file.relativePath, file]),
    );
    const received = new Set<string>();
    const failures = new Set<string>();

    if (files.length !== batch.totalFiles) failures.add('(파일 수 불일치)');
    for (const file of files) {
      assertSafeRepositoryPath(file.relativePath);
      try {
        assertNoPrivateKeyMaterial(file.relativePath, file.buffer);
      } catch {
        failures.add(file.relativePath);
        continue;
      }
      const metadata = expected.get(file.relativePath);
      if (!metadata || received.has(file.relativePath)) {
        failures.add(file.relativePath);
        continue;
      }
      received.add(file.relativePath);
      if (
        file.size !== file.buffer.length ||
        file.size !== metadata.size ||
        hashUploadBuffer(file.buffer) !== metadata.sha256
      ) {
        failures.add(file.relativePath);
      }
    }
    for (const relativePath of expected.keys()) {
      if (!received.has(relativePath)) failures.add(relativePath);
    }
    return [...failures];
  }

  private markBatchUploading(
    session: RepositoryUploadSession,
    batch: RepositoryUploadBatch,
  ): void {
    const now = new Date().toISOString();
    session.status = 'uploading';
    session.currentBatchIndex = batch.index;
    session.updatedAt = now;
    session.lastActivityAt = now;
    session.finalizationError = null;
    batch.status = 'uploading';
    batch.uploadedCount = 0;
    batch.uploadedBytes = 0;
    batch.failedFiles = [];
    batch.error = null;
    batch.updatedAt = now;
  }

  private async markBatchFailed(
    session: RepositoryUploadSession,
    batch: RepositoryUploadBatch,
    failedFiles: string[],
  ): Promise<void> {
    batch.status = 'failed';
    batch.uploadedCount = 0;
    batch.uploadedBytes = 0;
    batch.failedFiles = [...new Set(failedFiles)];
    batch.error = `${batch.failedFiles.length}개 파일의 업로드 또는 검증에 실패했습니다.`;
    batch.updatedAt = new Date().toISOString();
    this.recalculateSession(session);
    await this.uploadSessionRepository.save(session);
  }

  private recalculateSession(session: RepositoryUploadSession): void {
    session.uploadedCount = session.batches.reduce(
      (sum, batch) => sum + batch.uploadedCount,
      0,
    );
    session.uploadedBytes = session.batches.reduce(
      (sum, batch) => sum + batch.uploadedBytes,
      0,
    );
    session.failedFiles = [
      ...new Set(session.batches.flatMap((batch) => batch.failedFiles)),
    ];
    session.failedCount = session.failedFiles.length;
    session.currentBatchIndex = null;
    session.completedAt = null;
    session.status = session.batches.every(
      (batch) => batch.status === 'completed',
    )
      ? 'finalizing'
      : session.batches.some((batch) => batch.status === 'failed')
        ? 'partial_failed'
        : 'uploading';
    session.updatedAt = new Date().toISOString();
    session.lastActivityAt = session.updatedAt;
  }

  private toResult(
    project: Project,
    session: RepositoryUploadSession,
    batch: RepositoryUploadBatch,
  ): UploadSessionBatchResult {
    return {
      project,
      session,
      batchIndex: batch.index,
      uploadedCount: batch.uploadedCount,
      failedFiles: batch.failedFiles,
    };
  }
}
