import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Readable } from 'stream';
import {
  FILE_STORAGE,
  IFileStorage,
  UploadContentOffsetError,
  UploadContentTooLargeError,
} from '../../domain/repositories/file-storage.interface';
import { REPOSITORY_UPLOAD_LIMITS } from '../../domain/policies/upload-limits.policy';
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
import { RepositoryUploadIntegrityException } from '../errors/repository-upload-integrity.exception';
import { assertSafeRepositoryPath } from '../utils/repository-path.util';
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

export interface UploadSessionContentResult extends UploadSessionBatchResult {
  /** 서버가 지금까지 받은 바이트. 다음 조각은 이 위치부터 보낸다 */
  receivedBytes: number;
  /** 파일을 다 받고 해시까지 확인해 배치가 끝났는지 */
  completed: boolean;
}

@Injectable()
export class UploadSessionBatchUseCase {
  private readonly logger = new Logger(UploadSessionBatchUseCase.name);
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
      if (session.status === 'finalizing') {
        throw new ConflictException('이미 업로드 최종 반영이 진행 중입니다.');
      }

      const validation = this.validateFiles(batch, files);
      if (validation.failures.length > 0) {
        await this.markBatchFailed(session, batch, validation.failures);
        throw new RepositoryUploadIntegrityException(
          `배치 파일 무결성 검증에 실패했습니다: ${validation.failures.join(', ')}`,
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
        } catch (error) {
          const code = (error as NodeJS.ErrnoException)?.code;
          const reason = [
            'ENOSPC',
            'EDQUOT',
            'EACCES',
            'EPERM',
            'EIO',
            'ENOENT',
          ].includes(code ?? '')
            ? code
            : 'WRITE_FAILED';
          this.logger.error(
            `Upload write failed: session=${session.id} batch=${batch.index} code=${reason}`,
          );
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

  /**
   * 큰 파일 하나짜리 배치를 조각으로 받는다. offset 은 서버가 지금까지 받은 크기와 같아야 하고,
   * 다르면 받은 크기를 알려 주어 클라이언트가 그 위치부터 이어서 보내게 한다(끊긴 업로드 재개).
   * 마지막 조각을 받으면 전체 해시를 확인한 뒤 배치를 완료로 바꾼다.
   */
  async writeContent(
    projectId: string,
    sessionId: string,
    batchIndex: number,
    offset: number,
    body: Readable,
    ownerId?: string,
  ): Promise<UploadSessionContentResult> {
    return this.uploadCoordinator.runExclusive(projectId, async () => {
      try {
        const project = await this.projectRepository.findById(
          projectId,
          ownerId,
        );
        if (!project) {
          throw new NotFoundException(
            `프로젝트를 찾을 수 없습니다: ${projectId}`,
          );
        }
        if (!Number.isSafeInteger(offset) || offset < 0) {
          throw new BadRequestException(
            '업로드 위치(offset)가 올바르지 않습니다.',
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
          body.resume();
          return this.toContentResult(project, session, batch, true);
        }
        if (session.status === 'finalizing') {
          throw new ConflictException('이미 업로드 최종 반영이 진행 중입니다.');
        }
        if (batch.totalFiles !== 1 || batch.files.length !== 1) {
          throw new BadRequestException(
            '조각 업로드는 파일 하나짜리 배치에만 쓸 수 있습니다.',
          );
        }
        const file = batch.files[0];
        assertSafeRepositoryPath(file.relativePath);
        if (offset > file.size) {
          throw new BadRequestException(
            '업로드 위치가 파일 크기를 넘었습니다.',
          );
        }

        await this.fileStorage.prepareStagedUpload(
          project.name,
          session.id,
          session.replace,
        );
        if (batch.status !== 'uploading') {
          this.markBatchUploading(session, batch);
        }

        let receivedBytes: number;
        try {
          receivedBytes = await this.fileStorage.appendStagedContent(
            project.name,
            session.id,
            batch.index,
            offset,
            body,
            Math.min(REPOSITORY_UPLOAD_LIMITS.chunkBytes, file.size - offset),
          );
        } catch (error) {
          if (error instanceof UploadContentOffsetError) {
            body.resume();
            throw new ConflictException({
              message:
                '업로드 위치가 서버가 받은 크기와 다릅니다. 받은 위치부터 이어서 보내주세요.',
              receivedBytes: error.receivedBytes,
            });
          }
          if (error instanceof UploadContentTooLargeError) {
            throw new PayloadTooLargeException(error.message);
          }
          throw error;
        }

        batch.uploadedBytes = receivedBytes;
        batch.updatedAt = new Date().toISOString();
        session.lastActivityAt = batch.updatedAt;
        session.updatedAt = batch.updatedAt;

        if (receivedBytes < file.size) {
          await this.uploadSessionRepository.save(session);
          return this.toContentResult(project, session, batch, false);
        }

        const verified = await this.fileStorage.commitStagedContent(
          project.name,
          session.id,
          batch.index,
          file.relativePath,
          file.sha256,
        );
        if (!verified) {
          await this.markBatchFailed(session, batch, [file.relativePath]);
          throw new RepositoryUploadIntegrityException(
            `파일 무결성 검증에 실패했습니다: ${file.relativePath}. 처음부터 다시 보내주세요.`,
          );
        }
        batch.status = 'completed';
        batch.uploadedCount = 1;
        batch.uploadedBytes = file.size;
        batch.failedFiles = [];
        batch.error = null;
        batch.updatedAt = new Date().toISOString();
        this.recalculateSession(session);
        await this.uploadSessionRepository.save(session);
        return this.toContentResult(project, session, batch, true);
      } catch (error) {
        // 거절한 요청의 남은 본문은 버려서 연결이 매달리지 않게 한다
        body.resume();
        throw error;
      }
    });
  }

  private toContentResult(
    project: Project,
    session: RepositoryUploadSession,
    batch: RepositoryUploadBatch,
    completed: boolean,
  ): UploadSessionContentResult {
    return {
      ...this.toResult(project, session, batch),
      receivedBytes: completed
        ? batch.files.reduce((sum, file) => sum + file.size, 0)
        : batch.uploadedBytes,
      completed,
    };
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
  }

  private validateFiles(
    batch: RepositoryUploadBatch,
    files: UploadSessionBatchFile[],
  ): { failures: string[] } {
    const expected = new Map(
      batch.files.map((file) => [file.relativePath, file]),
    );
    const received = new Set<string>();
    const failures = new Set<string>();

    if (files.length !== batch.totalFiles) failures.add('(파일 수 불일치)');
    for (const file of files) {
      assertSafeRepositoryPath(file.relativePath);
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
    return {
      failures: [...failures],
    };
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
    this.logger.warn(
      `Upload batch failed: session=${session.id} batch=${batch.index} failedFiles=${batch.failedFiles.length}`,
    );
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
