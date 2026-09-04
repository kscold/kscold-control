import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { hasControlCharacter, isPathInsideRoot } from '../../../common/utils';
import { isReservedRepositoryPath } from '../../domain/policies/repository-path.policy';

export const LEGACY_VERSIONS_DIR = '.versions';
export const VERSION_STORE_DIR = '.repository-versions';
export const STAGING_DIR = '.upload-staging';
export const RECEIPT_DIR = '.upload-receipts';
export const BACKUP_DIR = '.upload-backups';

const PROJECT_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,99}$/;
const SESSION_ID_PATTERN = /^[0-9a-f-]{36}$/i;
const VERSION_ID_PATTERN = /^[0-9A-Za-z_-]{1,160}$/;

export class LocalStorageLayout {
  constructor(readonly baseDir: string) {}

  async initialize(): Promise<void> {
    const directories = [
      this.baseDir,
      this.internalPath(VERSION_STORE_DIR),
      this.internalPath(STAGING_DIR),
      this.internalPath(RECEIPT_DIR),
      this.internalPath(BACKUP_DIR),
    ];
    await Promise.all(
      directories.map(async (directory) => {
        await fs.mkdir(directory, { recursive: true, mode: 0o700 });
        await fs.chmod(directory, 0o700);
      }),
    );
    const probe = this.internalPath(`.write-test-${process.pid}`);
    await fs.writeFile(probe, 'ok');
    await fs.rm(probe, { force: true });
  }

  projectPath(projectName: string): string {
    this.assertProjectName(projectName);
    return path.join(this.baseDir, projectName);
  }

  stagingPath(projectName: string, sessionId: string): string {
    this.assertSessionId(sessionId);
    return path.join(
      this.internalProjectPath(STAGING_DIR, projectName),
      sessionId,
    );
  }

  receiptPath(projectName: string, sessionId: string): string {
    this.assertSessionId(sessionId);
    return path.join(
      this.internalProjectPath(RECEIPT_DIR, projectName),
      `${sessionId}.json`,
    );
  }

  backupPath(projectName: string, sessionId: string): string {
    this.assertSessionId(sessionId);
    return path.join(
      this.internalProjectPath(BACKUP_DIR, projectName),
      sessionId,
    );
  }

  versionDirectory(projectName: string): string {
    return this.internalProjectPath(VERSION_STORE_DIR, projectName);
  }

  internalProjectPath(directory: string, projectName: string): string {
    this.assertProjectName(projectName);
    return path.join(this.internalPath(directory), projectName);
  }

  internalPath(name: string): string {
    return path.join(this.baseDir, name);
  }

  safeRelativePath(root: string, relativePath: string): string {
    const normalized = relativePath.split(path.sep).join('/');
    const segments = normalized.split('/');
    const target = path.join(root, normalized);
    if (
      !normalized ||
      normalized.includes('\\') ||
      normalized.includes('\0') ||
      hasControlCharacter(normalized) ||
      normalized.length > 4096 ||
      path.posix.isAbsolute(normalized) ||
      path.win32.isAbsolute(normalized) ||
      path.posix.normalize(normalized) !== normalized ||
      segments.some(
        (segment) => !segment || segment === '..' || segment.length > 255,
      ) ||
      isReservedRepositoryPath(normalized) ||
      !isPathInsideRoot(root, target) ||
      target === root
    ) {
      throw new Error(`경로 순회 접근 차단: ${relativePath}`);
    }
    return target;
  }

  async assertNoSymlink(root: string, target: string): Promise<void> {
    const relative = path.relative(root, target);
    let current = root;
    for (const segment of relative.split(path.sep)) {
      current = path.join(current, segment);
      try {
        const stat = await fs.lstat(current);
        if (stat.isSymbolicLink()) {
          throw new Error(`심볼릭 링크 경로 접근 차단: ${relative}`);
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
  }

  assertProjectName(projectName: string): void {
    if (!PROJECT_NAME_PATTERN.test(projectName)) {
      throw new Error(`안전하지 않은 프로젝트 이름: ${projectName}`);
    }
  }

  assertSessionId(sessionId: string): void {
    if (!SESSION_ID_PATTERN.test(sessionId)) {
      throw new Error(`안전하지 않은 업로드 세션 ID: ${sessionId}`);
    }
  }

  assertVersionId(versionId: string): void {
    if (!VERSION_ID_PATTERN.test(versionId)) {
      throw new Error(`안전하지 않은 버전 ID: ${versionId}`);
    }
  }

  isProjectName(value: string): boolean {
    return PROJECT_NAME_PATTERN.test(value);
  }

  async exists(target: string): Promise<boolean> {
    try {
      await fs.access(target);
      return true;
    } catch {
      return false;
    }
  }

  async readDirectoryOrEmpty(directory: string) {
    try {
      return await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  async writeJsonAtomic(target: string, value: unknown): Promise<void> {
    await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, JSON.stringify(value, null, 2), {
        encoding: 'utf8',
        mode: 0o600,
      });
      await fs.rename(temporary, target);
    } finally {
      await fs.rm(temporary, { force: true });
    }
  }
}
