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
import {
  IUploadSessionRepository,
  UPLOAD_SESSION_REPOSITORY,
} from '../../domain/repositories/upload-session.repository.interface';
import {
  RepositoryUploadBatch,
  RepositoryUploadSession,
} from '../../domain/types/upload-session.type';
import { Project } from '../../domain/entities/project.entity';

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
  ) {}

  async execute(
    projectId: string,
    sessionId: string,
    batchIndex: number,
    files: UploadSessionBatchFile[],
  ): Promise<UploadSessionBatchResult> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundException(`프로젝트를 찾을 수 없습니다: ${projectId}`);
    }

    if (!files?.length) {
      throw new BadRequestException('업로드할 배치 파일이 없습니다');
    }

    const session = await this.uploadSessionRepository.findById(
      projectId,
      sessionId,
    );
    if (!session) {
      throw new NotFoundException(`업로드 세션을 찾을 수 없습니다: ${sessionId}`);
    }

    const batch = session.batches.find((item) => item.index === batchIndex);
    if (!batch) {
      throw new NotFoundException(`업로드 배치를 찾을 수 없습니다: ${batchIndex}`);
    }

    if (batch.status === 'completed' && session.status === 'completed') {
      return {
        project,
        session,
        batchIndex,
        uploadedCount: batch.uploadedCount,
        failedFiles: batch.failedFiles,
      };
    }

    const now = new Date().toISOString();
    session.status = 'uploading';
    session.currentBatchIndex = batchIndex;
    session.updatedAt = now;
    session.lastActivityAt = now;
    batch.status = 'uploading';
    batch.error = null;
    batch.updatedAt = now;
    await this.uploadSessionRepository.save(session);

    if (session.replace) {
      if (!session.replaceApplied) {
        await this.fileStorage.removeProject(project.name);
        await this.fileStorage.ensureProject(project.name);
        session.replaceApplied = true;
      }
    } else {
      await this.fileStorage.ensureProject(project.name);
    }

    const expectedFiles = new Map(
      batch.files.map((file) => [file.relativePath, file.size]),
    );
    const receivedPaths = new Set<string>();
    const failedFiles: string[] = [];
    let uploadedCount = 0;
    let uploadedBytes = 0;

    for (const file of files) {
      this.assertSafePath(file.relativePath);

      if (!expectedFiles.has(file.relativePath)) {
        failedFiles.push(file.relativePath);
        continue;
      }

      receivedPaths.add(file.relativePath);

      try {
        await this.fileStorage.writeFile(
          project.name,
          file.relativePath,
          file.buffer,
        );
        uploadedCount += 1;
        uploadedBytes += expectedFiles.get(file.relativePath) ?? file.size;
      } catch (error) {
        failedFiles.push(file.relativePath);
        batch.error = (error as Error).message;
      }
    }

    batch.files
      .filter((file) => !receivedPaths.has(file.relativePath))
      .forEach((file) => failedFiles.push(file.relativePath));

    batch.uploadedCount = uploadedCount;
    batch.uploadedBytes = uploadedBytes;
    batch.failedFiles = [...new Set(failedFiles)];
    batch.status = batch.failedFiles.length > 0 ? 'failed' : 'completed';
    batch.error =
      batch.failedFiles.length > 0
        ? `${batch.failedFiles.length}개 파일이 실패했습니다.`
        : null;
    batch.updatedAt = new Date().toISOString();

    this.recalculateSession(session);

    const persistedSession = await this.uploadSessionRepository.save(session);
    const stats = await this.fileStorage.getStats(project.name);
    const updatedProject = await this.projectRepository.update(projectId, {
      fileCount: stats.fileCount,
      totalSize: stats.totalSize,
    });

    return {
      project: updatedProject,
      session: persistedSession,
      batchIndex,
      uploadedCount: batch.uploadedCount,
      failedFiles: batch.failedFiles,
    };
  }

  private recalculateSession(session: RepositoryUploadSession) {
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

    const allCompleted = session.batches.every(
      (batch) => batch.status === 'completed',
    );
    const anyFailed = session.batches.some(
      (batch) => batch.status === 'failed' || batch.failedFiles.length > 0,
    );
    const anyUploaded = session.batches.some((batch) => batch.uploadedCount > 0);

    if (allCompleted) {
      session.status = 'completed';
      session.currentBatchIndex = null;
      session.completedAt = new Date().toISOString();
    } else if (anyFailed) {
      session.status = 'partial_failed';
      session.completedAt = null;
    } else if (anyUploaded) {
      session.status = 'uploading';
      session.completedAt = null;
    } else {
      session.status = 'pending';
      session.completedAt = null;
    }

    session.updatedAt = new Date().toISOString();
    session.lastActivityAt = session.updatedAt;
  }

  private assertSafePath(relativePath: string): void {
    if (relativePath.includes('..') || relativePath.startsWith('/')) {
      throw new BadRequestException(`안전하지 않은 경로: ${relativePath}`);
    }
  }
}
