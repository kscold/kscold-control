import { RepositoryUploadSession } from '../types/upload-session.type';

export const UPLOAD_SESSION_REPOSITORY = Symbol('UPLOAD_SESSION_REPOSITORY');

export interface IUploadSessionRepository {
  create(session: RepositoryUploadSession): Promise<RepositoryUploadSession>;
  findById(
    projectId: string,
    sessionId: string,
  ): Promise<RepositoryUploadSession | null>;
  findLatestByProject(
    projectId: string,
  ): Promise<RepositoryUploadSession | null>;
  save(session: RepositoryUploadSession): Promise<RepositoryUploadSession>;
}
