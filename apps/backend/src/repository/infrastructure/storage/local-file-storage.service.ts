import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { createReadStream as createNodeReadStream, promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Readable } from 'stream';
import {
  FileTreeNode,
  FinalizedUpload,
  IFileStorage,
  ProjectStats,
  ProjectVersion,
  RepositoryFileInspection,
  StagedUploadFile,
  StagedUploadInspection,
} from '../../domain/repositories/file-storage.interface';
import {
  containsPrivateKeyMaterial,
  isReservedRepositoryPath,
  isSensitiveRepositoryPath,
} from '../../domain/policies/repository-path.policy';
import {
  BACKUP_DIR,
  LEGACY_VERSIONS_DIR,
  LocalStorageLayout,
  RECEIPT_DIR,
  STAGING_DIR,
} from './local-storage-layout';
import { LocalUploadPublisher } from './local-upload-publisher';
import { LocalVersionStore } from './local-version-store';

@Injectable()
export class LocalFileStorageService implements IFileStorage, OnModuleInit {
  private readonly logger = new Logger(LocalFileStorageService.name);
  private readonly layout: LocalStorageLayout;
  private readonly versions: LocalVersionStore;
  private readonly publisher: LocalUploadPublisher;

  constructor() {
    const baseDir =
      process.env.REPOSITORY_STORAGE_DIR ??
      path.join(os.homedir(), 'repository-storage');
    this.layout = new LocalStorageLayout(baseDir);
    this.versions = new LocalVersionStore(this.layout, this.logger);
    this.publisher = new LocalUploadPublisher(
      this.layout,
      this.versions,
      (root) => this.inspectDirectory(root),
      this.logger,
    );
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.layout.initialize();
      await this.publisher.recoverInterruptedPublishes();
      this.logger.log(`저장소 디렉토리 준비 완료: ${this.layout.baseDir}`);
    } catch (error) {
      this.logger.error(
        `저장소 디렉토리를 준비할 수 없습니다: ${this.layout.baseDir} (${this.errorMessage(error)})`,
      );
      throw error;
    }
  }

  async ensureProject(projectName: string): Promise<void> {
    const directory = this.layout.projectPath(projectName);
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    await fs.chmod(directory, 0o700);
  }

  async prepareStagedUpload(
    projectName: string,
    sessionId: string,
    replace: boolean,
  ): Promise<void> {
    const stage = this.layout.stagingPath(projectName, sessionId);
    if (await this.layout.exists(stage)) return;

    await this.versions.migrateLegacyVersions(projectName);
    await fs.mkdir(path.dirname(stage), { recursive: true, mode: 0o700 });
    const live = this.layout.projectPath(projectName);
    if (!replace && (await this.layout.exists(live))) {
      const legacyVersions = path.join(live, LEGACY_VERSIONS_DIR);
      await fs.cp(live, stage, {
        recursive: true,
        errorOnExist: true,
        filter: (source) => source !== legacyVersions,
      });
      return;
    }
    await fs.mkdir(stage, { recursive: true, mode: 0o700 });
  }

  async writeStagedFile(
    projectName: string,
    sessionId: string,
    relativePath: string,
    buffer: Buffer,
  ): Promise<void> {
    const stage = this.layout.stagingPath(projectName, sessionId);
    if (!(await this.layout.exists(stage))) {
      throw new Error('업로드 스테이징 디렉토리가 없습니다.');
    }
    await this.writeBuffer(stage, relativePath, buffer);
  }

  inspectStagedUpload(
    projectName: string,
    sessionId: string,
  ): Promise<StagedUploadInspection> {
    return this.publisher.inspect(projectName, sessionId);
  }

  finalizeStagedUpload(
    projectName: string,
    sessionId: string,
  ): Promise<FinalizedUpload> {
    return this.publisher.finalize(projectName, sessionId);
  }

  discardStagedUpload(projectName: string, sessionId: string): Promise<void> {
    return this.publisher.discard(projectName, sessionId);
  }

  async removeProject(projectName: string): Promise<void> {
    this.layout.assertProjectName(projectName);
    await Promise.all([
      fs.rm(this.layout.projectPath(projectName), {
        recursive: true,
        force: true,
      }),
      fs.rm(this.layout.versionDirectory(projectName), {
        recursive: true,
        force: true,
      }),
      ...[STAGING_DIR, RECEIPT_DIR, BACKUP_DIR].map((directory) =>
        fs.rm(this.layout.internalProjectPath(directory, projectName), {
          recursive: true,
          force: true,
        }),
      ),
    ]);
  }

  async listTree(projectName: string): Promise<FileTreeNode> {
    const root = this.layout.projectPath(projectName);
    return this.walkTree(root, root, projectName);
  }

  async readFile(projectName: string, relativePath: string): Promise<Buffer> {
    const root = this.layout.projectPath(projectName);
    const target = this.layout.safeRelativePath(root, relativePath);
    await this.layout.assertNoSymlink(root, target);
    return fs.readFile(target);
  }

  async createReadStream(
    projectName: string,
    relativePath: string,
  ): Promise<Readable> {
    const root = this.layout.projectPath(projectName);
    const target = this.layout.safeRelativePath(root, relativePath);
    await this.layout.assertNoSymlink(root, target);
    return createNodeReadStream(target);
  }

  async archiveProject(projectName: string): Promise<Readable> {
    await this.inspectDirectory(this.layout.projectPath(projectName));
    return this.versions.createArchiveStream(projectName);
  }

  async getStats(projectName: string): Promise<ProjectStats> {
    return (await this.inspectDirectory(this.layout.projectPath(projectName)))
      .stats;
  }

  async createSnapshot(projectName: string): Promise<ProjectVersion> {
    await this.versions.migrateLegacyVersions(projectName);
    const live = this.layout.projectPath(projectName);
    await this.inspectDirectory(live);
    return this.versions.createSnapshot(projectName, live);
  }

  listVersions(projectName: string): Promise<ProjectVersion[]> {
    return this.versions.list(projectName);
  }

  cleanupVersions(projectName: string, keepCount = 1): Promise<number> {
    return this.versions.cleanup(projectName, keepCount);
  }

  readFileAtVersion(
    projectName: string,
    versionId: string,
    relativePath: string,
  ): Promise<Buffer | null> {
    return this.versions.readFile(projectName, versionId, relativePath);
  }

  async restoreVersion(projectName: string, versionId: string): Promise<void> {
    const archive = await this.versions.archivePath(projectName, versionId);
    await this.versions.validateArchive(archive);
    const targetVersion = await this.versions.getVersion(
      projectName,
      versionId,
    );

    const restoreId = randomUUID();
    const candidate = this.layout.stagingPath(projectName, restoreId);
    await fs.mkdir(candidate, { recursive: true, mode: 0o700 });

    let handedToPublisher = false;
    try {
      await this.versions.extract(archive, candidate);
      await this.inspectDirectory(candidate);
      handedToPublisher = true;
      await this.publisher.finalize(projectName, restoreId, targetVersion);
    } finally {
      if (!handedToPublisher) {
        await fs.rm(candidate, { recursive: true, force: true });
      }
    }
  }

  private async inspectDirectory(
    root: string,
  ): Promise<RepositoryFileInspection> {
    await fs.access(root);
    const files: StagedUploadFile[] = [];
    const stack = [root];

    while (stack.length > 0) {
      const current = stack.pop()!;
      const entries = await fs.readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        if (current === root && entry.name === LEGACY_VERSIONS_DIR) continue;
        const fullPath = path.join(current, entry.name);
        const relativePath = path
          .relative(root, fullPath)
          .split(path.sep)
          .join('/');
        if (
          isReservedRepositoryPath(relativePath) ||
          isSensitiveRepositoryPath(relativePath)
        ) {
          throw new Error(
            `예약 또는 민감 파일은 소스 저장소에 포함할 수 없습니다: ${relativePath}`,
          );
        }
        const stat = await fs.lstat(fullPath);
        if (stat.isSymbolicLink()) {
          throw new Error(
            `심볼릭 링크는 저장소에 포함할 수 없습니다: ${relativePath}`,
          );
        }
        if (stat.isDirectory()) {
          stack.push(fullPath);
        } else if (stat.isFile()) {
          const inspected = await this.inspectFile(fullPath);
          if (inspected.containsPrivateKey) {
            throw new Error(
              `비공개 키 자료가 포함된 파일은 소스 저장소에 포함할 수 없습니다: ${relativePath}`,
            );
          }
          files.push({
            relativePath,
            size: stat.size,
            sha256: inspected.sha256,
          });
        } else {
          throw new Error(
            `일반 파일이 아닌 항목은 저장소에 포함할 수 없습니다: ${relativePath}`,
          );
        }
      }
    }

    files.sort((left, right) =>
      left.relativePath.localeCompare(right.relativePath),
    );
    return {
      files,
      stats: {
        fileCount: files.length,
        totalSize: files.reduce((sum, file) => sum + file.size, 0),
      },
    };
  }

  private async walkTree(
    currentPath: string,
    root: string,
    name: string,
  ): Promise<FileTreeNode> {
    const stat = await fs.lstat(currentPath);
    if (stat.isSymbolicLink()) {
      throw new Error(`심볼릭 링크 조회 차단: ${name}`);
    }
    const relativePath = path
      .relative(root, currentPath)
      .split(path.sep)
      .join('/');
    if (stat.isFile()) {
      return { name, path: relativePath, type: 'file', size: stat.size };
    }

    const entries = (await fs.readdir(currentPath, { withFileTypes: true }))
      .filter(
        (entry) =>
          (currentPath !== root || entry.name !== LEGACY_VERSIONS_DIR) &&
          !isReservedRepositoryPath(
            path
              .relative(root, path.join(currentPath, entry.name))
              .split(path.sep)
              .join('/'),
          ) &&
          !isSensitiveRepositoryPath(
            path
              .relative(root, path.join(currentPath, entry.name))
              .split(path.sep)
              .join('/'),
          ),
      )
      .sort((left, right) => {
        if (left.isDirectory() !== right.isDirectory()) {
          return left.isDirectory() ? -1 : 1;
        }
        return left.name.localeCompare(right.name);
      });
    const children = await Promise.all(
      entries.map((entry) =>
        this.walkTree(path.join(currentPath, entry.name), root, entry.name),
      ),
    );
    return { name, path: relativePath, type: 'directory', children };
  }

  private async writeBuffer(
    root: string,
    relativePath: string,
    buffer: Buffer,
  ): Promise<void> {
    const target = this.layout.safeRelativePath(root, relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await this.layout.assertNoSymlink(root, target);
    const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, buffer, { flag: 'wx', mode: 0o600 });
      await fs.rename(temporary, target);
    } finally {
      await fs.rm(temporary, { force: true });
    }
  }

  private async inspectFile(
    filePath: string,
  ): Promise<{ sha256: string; containsPrivateKey: boolean }> {
    const hash = createHash('sha256');
    const previewChunks: Buffer[] = [];
    let previewBytes = 0;
    for await (const chunk of createNodeReadStream(filePath)) {
      const buffer = chunk as Buffer;
      hash.update(buffer);
      if (previewBytes < 128 * 1024) {
        const remaining = 128 * 1024 - previewBytes;
        const preview = buffer.subarray(0, remaining);
        previewChunks.push(preview);
        previewBytes += preview.length;
      }
    }
    return {
      sha256: hash.digest('hex'),
      containsPrivateKey: containsPrivateKeyMaterial(
        Buffer.concat(previewChunks).toString('utf8'),
      ),
    };
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
