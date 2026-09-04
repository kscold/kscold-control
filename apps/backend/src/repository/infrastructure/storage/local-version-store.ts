import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { spawn } from 'child_process';
import { hasControlCharacter } from '../../../common/utils';
import { ProjectVersion } from '../../domain/repositories/file-storage.interface';
import {
  isReservedRepositoryPath,
  isSensitiveRepositoryPath,
} from '../../domain/policies/repository-path.policy';
import {
  LEGACY_VERSIONS_DIR,
  LocalStorageLayout,
} from './local-storage-layout';

export class LocalVersionStore {
  constructor(
    private readonly layout: LocalStorageLayout,
    private readonly logger: Logger,
  ) {}

  async migrateLegacyVersions(projectName: string): Promise<void> {
    const legacy = path.join(
      this.layout.projectPath(projectName),
      LEGACY_VERSIONS_DIR,
    );
    const entries = await this.layout.readDirectoryOrEmpty(legacy);
    if (entries.length === 0) return;

    const destination = this.layout.versionDirectory(projectName);
    await fs.mkdir(destination, { recursive: true, mode: 0o700 });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.tar.gz')) continue;
      const target = path.join(destination, entry.name);
      if (!(await this.layout.exists(target))) {
        await fs.copyFile(path.join(legacy, entry.name), target);
        await fs.chmod(target, 0o600);
      }
    }
    await fs.rm(legacy, { recursive: true, force: true });
  }

  async createSnapshot(
    projectName: string,
    sourceDirectory: string,
  ): Promise<ProjectVersion> {
    const versions = this.layout.versionDirectory(projectName);
    await fs.mkdir(versions, { recursive: true, mode: 0o700 });
    const createdAt = new Date();
    const id = `${createdAt
      .toISOString()
      .replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
    const filename = `${id}.tar.gz`;
    const temporary = path.join(versions, `.${filename}.${process.pid}.tmp`);
    const destination = path.join(versions, filename);

    try {
      const result = await this.runTar([
        '-czf',
        temporary,
        '-C',
        sourceDirectory,
        '--exclude',
        `./${LEGACY_VERSIONS_DIR}`,
        '.',
      ]);
      if (result.code !== 0) {
        throw new Error(`스냅샷 생성 실패: ${result.stderr}`);
      }
      await fs.rename(temporary, destination);
      await fs.chmod(destination, 0o600);
    } finally {
      await fs.rm(temporary, { force: true });
    }

    const stat = await fs.stat(destination);
    return { id, createdAt, compressedSize: stat.size, filename };
  }

  async list(projectName: string): Promise<ProjectVersion[]> {
    await this.migrateLegacyVersions(projectName);
    const directory = this.layout.versionDirectory(projectName);
    const entries = await this.layout.readDirectoryOrEmpty(directory);
    const versions: ProjectVersion[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.tar.gz')) continue;
      const fullPath = path.join(directory, entry.name);
      try {
        const stat = await fs.stat(fullPath);
        versions.push({
          id: entry.name.slice(0, -'.tar.gz'.length),
          createdAt: stat.mtime,
          compressedSize: stat.size,
          filename: entry.name,
        });
      } catch (error) {
        this.logger.warn(
          `버전 파일 조회 실패: ${entry.name} (${this.errorMessage(error)})`,
        );
      }
    }
    return versions.sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    );
  }

  async cleanup(projectName: string, keepCount: number): Promise<number> {
    const versions = await this.list(projectName);
    const targets = versions.slice(Math.max(0, keepCount));
    await Promise.all(
      targets.map((version) =>
        fs.rm(
          path.join(
            this.layout.versionDirectory(projectName),
            version.filename,
          ),
          { force: true },
        ),
      ),
    );
    return targets.length;
  }

  async readFile(
    projectName: string,
    versionId: string,
    relativePath: string,
  ): Promise<Buffer | null> {
    const archive = await this.archivePath(projectName, versionId);
    const normalizedPath = this.normalizeArchiveRelativePath(relativePath);
    for (const candidate of [`./${normalizedPath}`, normalizedPath]) {
      const result = await this.runTar(['-xOzf', archive, '--', candidate]);
      if (result.code === 0) return result.stdout;
    }
    return null;
  }

  async archivePath(projectName: string, versionId: string): Promise<string> {
    this.layout.assertVersionId(versionId);
    await this.migrateLegacyVersions(projectName);
    const archive = path.join(
      this.layout.versionDirectory(projectName),
      `${versionId}.tar.gz`,
    );
    await fs.access(archive);
    return archive;
  }

  async getVersion(
    projectName: string,
    versionId: string,
  ): Promise<ProjectVersion> {
    const archive = await this.archivePath(projectName, versionId);
    const stat = await fs.stat(archive);
    return {
      id: versionId,
      createdAt: stat.mtime,
      compressedSize: stat.size,
      filename: `${versionId}.tar.gz`,
    };
  }

  async validateArchive(archive: string): Promise<void> {
    const result = await this.runTar(['-tzf', archive]);
    if (result.code !== 0) {
      throw new Error(`버전 아카이브 검증 실패: ${result.stderr}`);
    }
    for (const rawEntry of result.stdout.toString('utf8').split('\n')) {
      const entry = rawEntry.replace(/^\.\//, '').replace(/\/$/, '');
      if (entry) {
        const normalized = this.normalizeArchiveRelativePath(entry);
        if (isSensitiveRepositoryPath(normalized)) {
          throw new Error(
            `민감 파일이 포함된 버전은 복원할 수 없습니다: ${normalized}`,
          );
        }
      }
    }

    const verbose = await this.runTar(['-tvzf', archive]);
    if (verbose.code !== 0) {
      throw new Error(`버전 아카이브 유형 검증 실패: ${verbose.stderr}`);
    }
    for (const line of verbose.stdout.toString('utf8').split('\n')) {
      if (line && line[0] !== '-' && line[0] !== 'd') {
        throw new Error(
          '링크 또는 특수 파일이 포함된 버전은 복원할 수 없습니다.',
        );
      }
    }
  }

  async extract(archive: string, destination: string): Promise<void> {
    const result = await this.runTar(['-xzf', archive, '-C', destination]);
    if (result.code !== 0) {
      throw new Error(`버전 압축 해제 실패: ${result.stderr}`);
    }
  }

  async createArchiveStream(projectName: string): Promise<Readable> {
    const directory = this.layout.projectPath(projectName);
    await fs.access(directory);
    const tar = spawn(
      'tar',
      [
        '-czf',
        '-',
        '-C',
        directory,
        '--exclude',
        `./${LEGACY_VERSIONS_DIR}`,
        '.',
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    tar.stderr.on('data', (chunk: Buffer) => {
      this.logger.warn(`tar stderr: ${chunk.toString().trim()}`);
    });
    tar.on('error', (error) => this.logger.error('tar 실행 실패', error));
    return tar.stdout;
  }

  private normalizeArchiveRelativePath(relativePath: string): string {
    const normalized = relativePath.replace(/^\.\//, '').replace(/\/$/, '');
    if (
      !normalized ||
      normalized.includes('\\') ||
      normalized.includes('\0') ||
      hasControlCharacter(normalized) ||
      normalized.length > 4096 ||
      path.posix.isAbsolute(normalized) ||
      path.win32.isAbsolute(normalized) ||
      path.posix.normalize(normalized) !== normalized ||
      normalized
        .split('/')
        .some(
          (segment) =>
            !segment ||
            segment === '.' ||
            segment === '..' ||
            segment.length > 255,
        ) ||
      isReservedRepositoryPath(normalized)
    ) {
      throw new Error(`안전하지 않은 아카이브 경로: ${relativePath}`);
    }
    return normalized;
  }

  private runTar(
    args: string[],
  ): Promise<{ code: number; stdout: Buffer; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn('tar', args, { stdio: ['ignore', 'pipe', 'pipe'] });
      const stdout: Buffer[] = [];
      let stderr = '';
      child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.on('error', reject);
      child.on('exit', (code) => {
        resolve({
          code: code ?? 1,
          stdout: Buffer.concat(stdout),
          stderr: stderr.trim(),
        });
      });
    });
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
