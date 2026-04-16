import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  IUploadSessionRepository,
} from '../../domain/repositories/upload-session.repository.interface';
import { RepositoryUploadSession } from '../../domain/types/upload-session.type';

@Injectable()
export class LocalUploadSessionRepository implements IUploadSessionRepository {
  private readonly logger = new Logger(LocalUploadSessionRepository.name);
  private readonly baseDir: string;

  constructor() {
    const repositoryBaseDir =
      process.env.REPOSITORY_STORAGE_DIR ?? '/var/repos';
    this.baseDir =
      process.env.REPOSITORY_UPLOAD_SESSION_DIR ??
      path.join(repositoryBaseDir, '.upload-sessions');
  }

  async create(
    session: RepositoryUploadSession,
  ): Promise<RepositoryUploadSession> {
    await this.writeSession(session);
    return session;
  }

  async findById(
    projectId: string,
    sessionId: string,
  ): Promise<RepositoryUploadSession | null> {
    try {
      const content = await fs.readFile(
        this.sessionPath(projectId, sessionId),
        'utf8',
      );
      return JSON.parse(content) as RepositoryUploadSession;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }

      this.logger.error(
        `Failed to read upload session ${projectId}/${sessionId}: ${
          (error as Error).message
        }`,
      );
      throw error;
    }
  }

  async findLatestByProject(
    projectId: string,
  ): Promise<RepositoryUploadSession | null> {
    const directory = this.projectDirectory(projectId);

    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });
      const items = await Promise.all(
        entries
          .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
          .map(async (entry) => {
            const content = await fs.readFile(
              path.join(directory, entry.name),
              'utf8',
            );
            return JSON.parse(content) as RepositoryUploadSession;
          }),
      );

      return (
        items.sort(
          (left, right) =>
            new Date(right.updatedAt).getTime() -
            new Date(left.updatedAt).getTime(),
        )[0] ?? null
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }

      this.logger.error(
        `Failed to list upload sessions for ${projectId}: ${
          (error as Error).message
        }`,
      );
      throw error;
    }
  }

  async save(
    session: RepositoryUploadSession,
  ): Promise<RepositoryUploadSession> {
    await this.writeSession(session);
    return session;
  }

  private projectDirectory(projectId: string): string {
    return path.join(this.baseDir, path.basename(projectId));
  }

  private sessionPath(projectId: string, sessionId: string): string {
    return path.join(
      this.projectDirectory(projectId),
      `${path.basename(sessionId)}.json`,
    );
  }

  private async writeSession(session: RepositoryUploadSession): Promise<void> {
    const directory = this.projectDirectory(session.projectId);
    const targetPath = this.sessionPath(session.projectId, session.id);
    const tempPath = `${targetPath}.tmp`;

    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(tempPath, JSON.stringify(session, null, 2), 'utf8');
    await fs.rename(tempPath, targetPath);
  }
}
