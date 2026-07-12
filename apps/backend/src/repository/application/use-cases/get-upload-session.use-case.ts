import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  IProjectRepository,
  PROJECT_REPOSITORY,
} from '../../domain/repositories/project.repository.interface';
import {
  IUploadSessionRepository,
  UPLOAD_SESSION_REPOSITORY,
} from '../../domain/repositories/upload-session.repository.interface';
import { RepositoryUploadSession } from '../../domain/types/upload-session.type';

@Injectable()
export class GetUploadSessionUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: IProjectRepository,
    @Inject(UPLOAD_SESSION_REPOSITORY)
    private readonly uploadSessionRepository: IUploadSessionRepository,
  ) {}

  async executeLatest(
    projectId: string,
    ownerId?: string,
  ): Promise<RepositoryUploadSession | null> {
    await this.assertProjectAccess(projectId, ownerId);
    return this.uploadSessionRepository.findLatestByProject(projectId);
  }

  async executeById(
    projectId: string,
    sessionId: string,
    ownerId?: string,
  ): Promise<RepositoryUploadSession | null> {
    await this.assertProjectAccess(projectId, ownerId);
    return this.uploadSessionRepository.findById(projectId, sessionId);
  }

  private async assertProjectAccess(
    projectId: string,
    ownerId?: string,
  ): Promise<void> {
    const project = await this.projectRepository.findById(projectId, ownerId);
    if (!project) {
      throw new NotFoundException(`프로젝트를 찾을 수 없습니다: ${projectId}`);
    }
  }
}
