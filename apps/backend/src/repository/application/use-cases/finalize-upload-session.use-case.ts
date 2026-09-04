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
  StagedUploadFile,
  StagedUploadInspection,
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
  RepositoryUploadSession,
} from '../../domain/types/upload-session.type';
import { Project } from '../../domain/entities/project.entity';
import { RepositoryUploadCoordinator } from '../services/repository-upload-coordinator.service';
import { buildUploadManifestDigest } from '../utils/upload-manifest.util';

export interface FinalizeUploadSessionResult {
  project: Project;
  session: RepositoryUploadSession;
}

@Injectable()
export class FinalizeUploadSessionUseCase {
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
    ownerId?: string,
  ): Promise<FinalizeUploadSessionResult> {
    return this.uploadCoordinator.runExclusive(projectId, async () => {
      const project = await this.projectRepository.findById(projectId, ownerId);
      if (!project) {
        throw new NotFoundException(
          `프로젝트를 찾을 수 없습니다: ${projectId}`,
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
      if (
        session.status === 'superseded' ||
        session.protocolVersion !== REPOSITORY_UPLOAD_PROTOCOL_VERSION ||
        session.projectName !== project.name
      ) {
        throw new ConflictException(
          '현재 업로드 세션은 최종 반영할 수 없습니다. 새 세션을 시작해주세요.',
        );
      }
      if (session.status === 'completed') return { project, session };
      if (
        !session.batches.length ||
        session.batches.some((batch) => batch.status !== 'completed')
      ) {
        throw new BadRequestException(
          '완료되지 않은 업로드 배치가 있어 최종 반영할 수 없습니다.',
        );
      }

      session.status = 'finalizing';
      session.currentBatchIndex = null;
      session.finalizationError = null;
      session.updatedAt = new Date().toISOString();
      session.lastActivityAt = session.updatedAt;
      await this.uploadSessionRepository.save(session);

      let inspection: StagedUploadInspection;
      try {
        inspection = await this.fileStorage.inspectStagedUpload(
          project.name,
          session.id,
        );
      } catch (error) {
        await this.markFinalizationFailed(session, error);
        throw error;
      }
      try {
        this.assertStagedUploadMatchesSession(session, inspection);
      } catch (error) {
        if (inspection.source === 'staging') {
          await this.resetRejectedStaging(project.name, session, error);
        } else {
          await this.supersedeInvalidPublishedSession(session, error);
        }
        throw error;
      }

      let finalized: Awaited<
        ReturnType<IFileStorage['finalizeStagedUpload']>
      > | null = null;
      try {
        finalized = await this.fileStorage.finalizeStagedUpload(
          project.name,
          session.id,
        );
        session.replaceApplied = true;
        session.publishedAt = finalized.publishedAt;
        session.snapshotId = finalized.version.id;
        const updatedProject = await this.projectRepository.update(projectId, {
          fileCount: finalized.stats.fileCount,
          totalSize: finalized.stats.totalSize,
        });

        session.status = 'completed';
        session.uploadedCount = session.totalFiles;
        session.uploadedBytes = session.totalBytes;
        session.failedCount = 0;
        session.failedFiles = [];
        session.currentBatchIndex = null;
        session.completedAt = finalized.publishedAt;
        session.finalizationError = null;
        session.updatedAt = new Date().toISOString();
        session.lastActivityAt = session.updatedAt;
        const persisted = await this.uploadSessionRepository.save(session);
        return { project: updatedProject, session: persisted };
      } catch (error) {
        if (finalized) {
          session.replaceApplied = true;
          session.publishedAt = finalized.publishedAt;
          session.snapshotId = finalized.version.id;
        }
        await this.markFinalizationFailed(session, error);
        throw error;
      }
    });
  }

  private async supersedeInvalidPublishedSession(
    session: RepositoryUploadSession,
    error: unknown,
  ): Promise<void> {
    session.status = 'superseded';
    session.replaceApplied = true;
    session.currentBatchIndex = null;
    session.completedAt = null;
    session.finalizationError = `${this.safeErrorMessage(error)} 새 업로드 세션이 필요합니다.`;
    session.updatedAt = new Date().toISOString();
    session.lastActivityAt = session.updatedAt;
    await this.uploadSessionRepository.save(session);
  }

  private async markFinalizationFailed(
    session: RepositoryUploadSession,
    error: unknown,
  ): Promise<void> {
    session.status = 'finalization_failed';
    session.completedAt = null;
    session.finalizationError = this.safeErrorMessage(error);
    session.updatedAt = new Date().toISOString();
    session.lastActivityAt = session.updatedAt;
    await this.uploadSessionRepository.save(session);
  }

  private async resetRejectedStaging(
    projectName: string,
    session: RepositoryUploadSession,
    error: unknown,
  ): Promise<void> {
    try {
      await this.fileStorage.discardStagedUpload(projectName, session.id);
      const now = new Date().toISOString();
      for (const batch of session.batches) {
        batch.status = 'pending';
        batch.uploadedCount = 0;
        batch.uploadedBytes = 0;
        batch.failedFiles = [];
        batch.error = null;
        batch.updatedAt = now;
      }
      session.status = 'partial_failed';
      session.uploadedCount = 0;
      session.uploadedBytes = 0;
      session.failedCount = 0;
      session.failedFiles = [];
      session.currentBatchIndex = null;
      session.completedAt = null;
      session.finalizationError = this.safeErrorMessage(error);
      session.updatedAt = now;
      session.lastActivityAt = now;
      await this.uploadSessionRepository.save(session);
    } catch (cleanupError) {
      session.status = 'finalization_failed';
      session.finalizationError = `${this.safeErrorMessage(error)} (스테이징 정리 실패: ${this.safeErrorMessage(cleanupError)})`;
      session.updatedAt = new Date().toISOString();
      session.lastActivityAt = session.updatedAt;
      await this.uploadSessionRepository.save(session);
    }
  }

  private assertStagedUploadMatchesSession(
    session: RepositoryUploadSession,
    inspection: StagedUploadInspection,
  ): void {
    const expected = new Map(
      session.batches
        .flatMap((batch) => batch.files)
        .map((file) => [file.relativePath, file]),
    );
    const actual = new Map(
      inspection.files.map((file) => [file.relativePath, file]),
    );
    const verifiedFiles: StagedUploadFile[] = [];

    for (const [relativePath, metadata] of expected) {
      const staged = actual.get(relativePath);
      if (
        !staged ||
        staged.size !== metadata.size ||
        staged.sha256 !== metadata.sha256
      ) {
        throw new BadRequestException(
          `최종 파일 무결성 검증에 실패했습니다: ${relativePath}`,
        );
      }
      verifiedFiles.push(staged);
    }

    if (session.replace && actual.size !== expected.size) {
      throw new BadRequestException(
        '선언되지 않은 파일이 포함되어 최종 반영을 중단했습니다.',
      );
    }
    if (buildUploadManifestDigest(verifiedFiles) !== session.manifestDigest) {
      throw new BadRequestException(
        '최종 업로드 파일 목록 해시가 세션과 일치하지 않습니다.',
      );
    }
  }

  private safeErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message.replace(/[\r\n]+/g, ' ').slice(0, 500);
  }
}
