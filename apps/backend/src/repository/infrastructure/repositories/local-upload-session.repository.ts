import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import * as os from 'os';
import * as path from 'path';
import { IUploadSessionRepository } from '../../domain/repositories/upload-session.repository.interface';
import { RepositoryUploadSession } from '../../domain/types/upload-session.type';

const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{1,160}$/;
const PROJECT_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,99}$/;
const SESSION_STATUSES = new Set([
  'pending',
  'uploading',
  'partial_failed',
  'finalizing',
  'finalization_failed',
  'superseded',
  'completed',
]);

@Injectable()
export class LocalUploadSessionRepository implements IUploadSessionRepository {
  private readonly logger = new Logger(LocalUploadSessionRepository.name);
  private readonly baseDir: string;

  constructor() {
    const repositoryBaseDir =
      process.env.REPOSITORY_STORAGE_DIR ??
      path.join(os.homedir(), 'repository-storage');
    this.baseDir =
      process.env.REPOSITORY_UPLOAD_SESSION_DIR ??
      path.join(repositoryBaseDir, '.upload-sessions');
  }

  async create(
    session: RepositoryUploadSession,
  ): Promise<RepositoryUploadSession> {
    await this.writeSession(session);
    await this.pruneOldSessions(session.projectId, 25).catch((error: Error) => {
      this.logger.warn(
        `오래된 업로드 세션 정리에 실패했습니다: ${error.message}`,
      );
    });
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
      return this.parseSession(content, projectId, sessionId);
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
            try {
              const content = await fs.readFile(
                path.join(directory, entry.name),
                'utf8',
              );
              return this.parseSession(
                content,
                projectId,
                entry.name.slice(0, -'.json'.length),
              );
            } catch (error) {
              this.logger.warn(
                `손상된 업로드 세션 파일을 건너뜁니다: ${entry.name} (${(error as Error).message})`,
              );
              return null;
            }
          }),
      );

      return (
        items
          .filter((item): item is RepositoryUploadSession => item !== null)
          .sort(
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

  async removeByProject(projectId: string): Promise<void> {
    await fs.rm(this.projectDirectory(projectId), {
      recursive: true,
      force: true,
    });
  }

  private projectDirectory(projectId: string): string {
    this.assertSafeIdentifier(projectId, '프로젝트 ID');
    return path.join(this.baseDir, projectId);
  }

  private sessionPath(projectId: string, sessionId: string): string {
    this.assertSafeIdentifier(sessionId, '업로드 세션 ID');
    return path.join(this.projectDirectory(projectId), `${sessionId}.json`);
  }

  private async writeSession(session: RepositoryUploadSession): Promise<void> {
    const directory = this.projectDirectory(session.projectId);
    const targetPath = this.sessionPath(session.projectId, session.id);
    const tempPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;

    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    try {
      await fs.writeFile(tempPath, JSON.stringify(session, null, 2), {
        encoding: 'utf8',
        mode: 0o600,
      });
      await fs.rename(tempPath, targetPath);
    } finally {
      await fs.rm(tempPath, { force: true });
    }
  }

  private assertSafeIdentifier(value: string, label: string): void {
    if (!SAFE_IDENTIFIER_PATTERN.test(value)) {
      throw new Error(`${label}가 올바르지 않습니다.`);
    }
  }

  private parseSession(
    content: string,
    expectedProjectId: string,
    expectedSessionId: string,
  ): RepositoryUploadSession {
    const parsed: unknown = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('업로드 세션 형식이 올바르지 않습니다.');
    }

    const session = parsed as RepositoryUploadSession;
    if (
      session.id !== expectedSessionId ||
      session.projectId !== expectedProjectId ||
      !PROJECT_NAME_PATTERN.test(session.projectName) ||
      !SESSION_STATUSES.has(session.status) ||
      typeof session.updatedAt !== 'string' ||
      !Number.isFinite(Date.parse(session.updatedAt)) ||
      !Array.isArray(session.batches)
    ) {
      throw new Error('업로드 세션 식별자 또는 필수 구조가 손상되었습니다.');
    }
    return session;
  }

  private async pruneOldSessions(
    projectId: string,
    keepCount: number,
  ): Promise<void> {
    const directory = this.projectDirectory(projectId);
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const sessions = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map(async (entry) => ({
          path: path.join(directory, entry.name),
          mtimeMs: (await fs.stat(path.join(directory, entry.name))).mtimeMs,
        })),
    );
    sessions.sort((left, right) => right.mtimeMs - left.mtimeMs);
    await Promise.all(
      sessions
        .slice(Math.max(1, keepCount))
        .map((session) => fs.rm(session.path, { force: true })),
    );
  }
}
