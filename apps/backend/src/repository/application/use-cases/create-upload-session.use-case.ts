import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
  RepositoryUploadBatchFile,
  RepositoryUploadSession,
} from '../../domain/types/upload-session.type';

export interface CreateUploadSessionBatchInput {
  index: number;
  totalFiles: number;
  totalBytes: number;
  files: RepositoryUploadBatchFile[];
}

export interface CreateUploadSessionInput {
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
    @Inject(UPLOAD_SESSION_REPOSITORY)
    private readonly uploadSessionRepository: IUploadSessionRepository,
  ) {}

  async execute(
    projectId: string,
    input: CreateUploadSessionInput,
    ownerId?: string,
  ): Promise<RepositoryUploadSession> {
    const project = await this.projectRepository.findById(projectId, ownerId);
    if (!project) {
      throw new NotFoundException(`프로젝트를 찾을 수 없습니다: ${projectId}`);
    }

    if (!input.batches?.length || input.totalFiles <= 0) {
      throw new BadRequestException(
        '업로드 세션 메타데이터가 올바르지 않습니다.',
      );
    }

    const normalizedBatches = [...input.batches]
      .sort((left, right) => left.index - right.index)
      .map((batch, index) => this.normalizeBatch(batch, index));

    const computedTotalFiles = normalizedBatches.reduce(
      (sum, batch) => sum + batch.totalFiles,
      0,
    );
    const computedTotalBytes = normalizedBatches.reduce(
      (sum, batch) => sum + batch.totalBytes,
      0,
    );

    if (
      computedTotalFiles !== input.totalFiles ||
      computedTotalBytes !== input.totalBytes
    ) {
      throw new BadRequestException(
        '업로드 파일 수 또는 총 바이트가 세션 메타데이터와 일치하지 않습니다.',
      );
    }

    const now = new Date().toISOString();
    const session: RepositoryUploadSession = {
      id: randomUUID(),
      projectId,
      projectName: project.name,
      status: 'pending',
      manifestDigest: input.manifestDigest,
      replace: Boolean(input.replace),
      replaceApplied: false,
      totalFiles: input.totalFiles,
      totalBytes: input.totalBytes,
      filteredCount: Math.max(0, input.filteredCount || 0),
      batchTotal: normalizedBatches.length,
      uploadedCount: 0,
      uploadedBytes: 0,
      failedCount: 0,
      failedFiles: [],
      batches: normalizedBatches,
      currentBatchIndex: null,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
      completedAt: null,
    };

    return this.uploadSessionRepository.create(session);
  }

  private normalizeBatch(
    batch: CreateUploadSessionBatchInput,
    expectedIndex: number,
  ): RepositoryUploadBatch {
    if (batch.index !== expectedIndex) {
      throw new BadRequestException('업로드 배치 인덱스가 올바르지 않습니다.');
    }

    if (!batch.files?.length || batch.totalFiles <= 0 || batch.totalBytes < 0) {
      throw new BadRequestException(
        '업로드 배치 메타데이터가 올바르지 않습니다.',
      );
    }

    const computedTotalFiles = batch.files.length;
    const computedTotalBytes = batch.files.reduce(
      (sum, file) => sum + Math.max(0, file.size),
      0,
    );

    if (
      computedTotalFiles !== batch.totalFiles ||
      computedTotalBytes !== batch.totalBytes
    ) {
      throw new BadRequestException(
        '배치 파일 수 또는 바이트가 메타데이터와 일치하지 않습니다.',
      );
    }

    return {
      index: batch.index,
      totalFiles: batch.totalFiles,
      totalBytes: batch.totalBytes,
      status: 'pending',
      files: batch.files.map((file) => ({
        relativePath: file.relativePath,
        size: file.size,
      })),
      uploadedCount: 0,
      uploadedBytes: 0,
      failedFiles: [],
      error: null,
      updatedAt: null,
    };
  }
}
