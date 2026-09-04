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
import {
  IUploadSessionRepository,
  UPLOAD_SESSION_REPOSITORY,
} from '../../domain/repositories/upload-session.repository.interface';
import {
  REPOSITORY_UPLOAD_PROTOCOL_VERSION,
  RepositoryUploadBatch,
  RepositoryUploadBatchFile,
  RepositoryUploadSession,
} from '../../domain/types/upload-session.type';
import { RepositoryUploadCoordinator } from '../services/repository-upload-coordinator.service';
import { assertSafeRepositoryPath } from '../utils/repository-path.util';
import {
  buildUploadManifestDigest,
  MANIFEST_DIGEST_PATTERN,
  SHA256_HEX_PATTERN,
} from '../utils/upload-manifest.util';

export interface CreateUploadSessionBatchInput {
  index: number;
  totalFiles: number;
  totalBytes: number;
  files: RepositoryUploadBatchFile[];
}

export interface CreateUploadSessionInput {
  protocolVersion: number;
  replace: boolean;
  totalFiles: number;
  totalBytes: number;
  filteredCount: number;
  manifestDigest: string;
  batches: CreateUploadSessionBatchInput[];
}

@Injectable()
export class CreateUploadSessionUseCase {
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
    input: CreateUploadSessionInput,
    ownerId?: string,
  ): Promise<RepositoryUploadSession> {
    return this.uploadCoordinator.runExclusive(projectId, async () => {
      const project = await this.projectRepository.findById(projectId, ownerId);
      if (!project) {
        throw new NotFoundException(
          `프로젝트를 찾을 수 없습니다: ${projectId}`,
        );
      }

      const batches = this.validateAndNormalizeInput(input);
      const sessionId = randomUUID();
      const previous =
        await this.uploadSessionRepository.findLatestByProject(projectId);

      if (previous && !['completed', 'superseded'].includes(previous.status)) {
        const now = new Date().toISOString();
        previous.status = 'superseded';
        previous.currentBatchIndex = null;
        previous.updatedAt = now;
        previous.lastActivityAt = now;
        previous.finalizationError =
          '더 최신 업로드 세션이 시작되어 종료되었습니다.';
        await this.uploadSessionRepository.save(previous);
        await this.fileStorage.discardStagedUpload(
          previous.projectName,
          previous.id,
        );
      }

      await this.fileStorage.prepareStagedUpload(
        project.name,
        sessionId,
        input.replace,
      );

      const now = new Date().toISOString();
      const session: RepositoryUploadSession = {
        id: sessionId,
        protocolVersion: REPOSITORY_UPLOAD_PROTOCOL_VERSION,
        projectId,
        projectName: project.name,
        status: 'pending',
        manifestDigest: input.manifestDigest,
        replace: Boolean(input.replace),
        replaceApplied: false,
        totalFiles: input.totalFiles,
        totalBytes: input.totalBytes,
        filteredCount: Math.max(0, input.filteredCount || 0),
        batchTotal: batches.length,
        uploadedCount: 0,
        uploadedBytes: 0,
        failedCount: 0,
        failedFiles: [],
        batches,
        currentBatchIndex: null,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
        completedAt: null,
        publishedAt: null,
        snapshotId: null,
        finalizationError: null,
      };

      try {
        return await this.uploadSessionRepository.create(session);
      } catch (error) {
        await this.fileStorage.discardStagedUpload(project.name, sessionId);
        throw error;
      }
    });
  }

  private validateAndNormalizeInput(
    input: CreateUploadSessionInput,
  ): RepositoryUploadBatch[] {
    if (input.protocolVersion !== REPOSITORY_UPLOAD_PROTOCOL_VERSION) {
      throw new BadRequestException(
        `지원하지 않는 업로드 프로토콜입니다. v${REPOSITORY_UPLOAD_PROTOCOL_VERSION}로 다시 시도해주세요.`,
      );
    }
    if (
      !input.batches?.length ||
      !Number.isInteger(input.totalFiles) ||
      input.totalFiles <= 0 ||
      !Number.isSafeInteger(input.totalBytes) ||
      input.totalBytes < 0 ||
      !MANIFEST_DIGEST_PATTERN.test(input.manifestDigest)
    ) {
      throw new BadRequestException(
        '업로드 세션 메타데이터가 올바르지 않습니다.',
      );
    }

    const seenPaths = new Set<string>();
    const batches = [...input.batches]
      .sort((left, right) => left.index - right.index)
      .map((batch, index) => this.normalizeBatch(batch, index, seenPaths));
    const files = batches.flatMap((batch) => batch.files);
    const computedTotalBytes = files.reduce((sum, file) => sum + file.size, 0);

    if (
      files.length !== input.totalFiles ||
      computedTotalBytes !== input.totalBytes
    ) {
      throw new BadRequestException(
        '업로드 파일 수 또는 총 바이트가 세션 메타데이터와 일치하지 않습니다.',
      );
    }
    if (buildUploadManifestDigest(files) !== input.manifestDigest) {
      throw new BadRequestException(
        '업로드 파일 목록 해시가 세션 메타데이터와 일치하지 않습니다.',
      );
    }

    return batches;
  }

  private normalizeBatch(
    batch: CreateUploadSessionBatchInput,
    expectedIndex: number,
    seenPaths: Set<string>,
  ): RepositoryUploadBatch {
    if (
      batch.index !== expectedIndex ||
      !batch.files?.length ||
      batch.files.length > 200 ||
      batch.totalFiles !== batch.files.length ||
      !Number.isSafeInteger(batch.totalBytes) ||
      batch.totalBytes < 0
    ) {
      throw new BadRequestException(
        '업로드 배치 메타데이터가 올바르지 않습니다.',
      );
    }

    const files = batch.files.map((file) => {
      assertSafeRepositoryPath(file.relativePath);
      if (
        !Number.isSafeInteger(file.size) ||
        file.size < 0 ||
        file.size > 50 * 1024 * 1024 ||
        !SHA256_HEX_PATTERN.test(file.sha256)
      ) {
        throw new BadRequestException(
          `파일 메타데이터가 올바르지 않습니다: ${file.relativePath}`,
        );
      }
      if (seenPaths.has(file.relativePath)) {
        throw new BadRequestException(
          `중복된 업로드 파일 경로입니다: ${file.relativePath}`,
        );
      }
      seenPaths.add(file.relativePath);
      return { ...file };
    });
    const computedTotalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (computedTotalBytes !== batch.totalBytes) {
      throw new BadRequestException(
        '배치 파일 바이트가 메타데이터와 일치하지 않습니다.',
      );
    }

    return {
      index: batch.index,
      totalFiles: batch.totalFiles,
      totalBytes: batch.totalBytes,
      status: 'pending',
      files,
      uploadedCount: 0,
      uploadedBytes: 0,
      failedFiles: [],
      error: null,
      updatedAt: null,
    };
  }
}
