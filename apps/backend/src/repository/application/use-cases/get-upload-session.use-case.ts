import { Inject, Injectable } from '@nestjs/common';
import {
  IUploadSessionRepository,
  UPLOAD_SESSION_REPOSITORY,
} from '../../domain/repositories/upload-session.repository.interface';
import { RepositoryUploadSession } from '../../domain/types/upload-session.type';

@Injectable()
export class GetUploadSessionUseCase {
  constructor(
    @Inject(UPLOAD_SESSION_REPOSITORY)
    private readonly uploadSessionRepository: IUploadSessionRepository,
  ) {}

  executeLatest(projectId: string): Promise<RepositoryUploadSession | null> {
    return this.uploadSessionRepository.findLatestByProject(projectId);
  }

  executeById(
    projectId: string,
    sessionId: string,
  ): Promise<RepositoryUploadSession | null> {
    return this.uploadSessionRepository.findById(projectId, sessionId);
  }
}
