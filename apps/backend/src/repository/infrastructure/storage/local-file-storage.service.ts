import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { promises as fs, createReadStream } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Readable } from 'stream';
import { spawn } from 'child_process';
import {
  FileTreeNode,
  IFileStorage,
  ProjectStats,
  ProjectVersion,
} from '../../domain/repositories/file-storage.interface';

const VERSIONS_DIR = '.versions';

@Injectable()
export class LocalFileStorageService implements IFileStorage, OnModuleInit {
  private readonly logger = new Logger(LocalFileStorageService.name);
  private readonly baseDir: string;

  constructor() {
    // 기본값을 사용자 홈 하위로 둔다. 과거 기본값 '/var/repos'는 macOS/Linux 모두
    // root 권한이 필요해, REPOSITORY_STORAGE_DIR 환경변수가 프로세스에 전달되지
    // 않으면 모든 업로드가 EACCES(permission denied, mkdir '/var/repos')로 통째로
    // 실패하는 사고가 있었다. 쓰기 가능한 안전한 기본값으로 바꾼다.
    this.baseDir =
      process.env.REPOSITORY_STORAGE_DIR ??
      path.join(os.homedir(), 'repository-storage');
  }

  /**
   * 부팅 시 저장소 디렉토리를 생성하고 실제 쓰기 가능 여부를 점검한다.
   * 문제가 있으면(권한 없음 등) 업로드가 조용히 실패하지 않도록 명확한
   * 조치 안내와 함께 에러 로그를 남긴다. (패널 전체를 죽이지는 않는다.)
   */
  async onModuleInit(): Promise<void> {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
      const probe = path.join(this.baseDir, `.write-test-${process.pid}`);
      await fs.writeFile(probe, 'ok');
      await fs.rm(probe, { force: true });
      this.logger.log(`저장소 디렉토리 준비 완료: ${this.baseDir}`);
    } catch (err) {
      const reason = (err as Error).message;
      this.logger.error(
        [
          `저장소 디렉토리를 쓸 수 없습니다: ${this.baseDir} (${reason})`,
          `→ 소스 업로드가 실패합니다. 쓰기 가능한 경로를 REPOSITORY_STORAGE_DIR 로 지정하고 재시작하세요.`,
          `  예) REPOSITORY_STORAGE_DIR=${path.join(os.homedir(), 'repository-storage')}`,
          `  PM2 사용 시: pm2 start ecosystem.config.js --update-env`,
        ].join('\n'),
      );
    }
  }

  // ── 경로 헬퍼 ──────────────────────────────────────────────────────────────

  private projectPath(projectName: string): string {
    const safe = path.basename(projectName);
    return path.join(this.baseDir, safe);
  }

  /**
   * 경로 순회 공격 방어: target 이 projectDir 하위인지 확인.
   * 위반 시 Error 를 throw 합니다.
   */
  private assertSafeFilePath(projectDir: string, target: string): void {
    const root = path.resolve(projectDir);
    const resolvedTarget = path.resolve(target);
    if (
      resolvedTarget !== root &&
      !resolvedTarget.startsWith(`${root}${path.sep}`)
    ) {
      throw new Error(
        `Path traversal blocked: ${path.relative(projectDir, target)}`,
      );
    }
  }

  // ── 기본 파일 조작 ─────────────────────────────────────────────────────────

  async ensureProject(projectName: string): Promise<void> {
    const dir = this.projectPath(projectName);
    await fs.mkdir(dir, { recursive: true });
  }

  async writeFile(
    projectName: string,
    relativePath: string,
    buffer: Buffer,
  ): Promise<void> {
    const dir = this.projectPath(projectName);
    const target = path.join(dir, relativePath);
    this.assertSafeFilePath(dir, target);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);
  }

  async removeProject(projectName: string): Promise<void> {
    const dir = this.projectPath(projectName);
    await fs.rm(dir, { recursive: true, force: true });
  }

  /**
   * 프로젝트 콘텐츠만 비우고 .versions 버전 히스토리는 보존한다.
   * replace 업로드 시 이 메서드를 사용해야 이전 버전 스냅샷이 누적된다.
   * (removeProject는 .versions 포함 전체를 삭제하므로 버전 히스토리가 사라진다.)
   */
  async clearProjectFiles(projectName: string): Promise<void> {
    const dir = this.projectPath(projectName);

    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      // 프로젝트 디렉토리가 아직 없으면 비울 것도 없음
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw err;
    }

    for (const entry of entries) {
      if (entry.name === VERSIONS_DIR) continue; // 버전 히스토리 보존
      await fs.rm(path.join(dir, entry.name), { recursive: true, force: true });
    }
  }

  async readFile(projectName: string, relativePath: string): Promise<Buffer> {
    const dir = this.projectPath(projectName);
    const target = path.join(dir, relativePath);
    this.assertSafeFilePath(dir, target);
    return fs.readFile(target);
  }

  async createReadStream(
    projectName: string,
    relativePath: string,
  ): Promise<Readable> {
    const dir = this.projectPath(projectName);
    const target = path.join(dir, relativePath);
    this.assertSafeFilePath(dir, target);
    return createReadStream(target);
  }

  // ── 파일 트리 조회 (.versions 제외) ───────────────────────────────────────

  async listTree(projectName: string): Promise<FileTreeNode> {
    const root = this.projectPath(projectName);
    return this.walk(root, root, projectName);
  }

  private async walk(
    currentPath: string,
    root: string,
    name: string,
  ): Promise<FileTreeNode> {
    const stats = await fs.stat(currentPath);
    const relPath = path.relative(root, currentPath) || '';

    if (stats.isFile()) {
      return { name, path: relPath, type: 'file', size: stats.size };
    }

    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    const children: FileTreeNode[] = [];

    for (const entry of entries
      .filter((e) => e.name !== VERSIONS_DIR) // .versions 숨김
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory())
          return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      })) {
      const child = await this.walk(
        path.join(currentPath, entry.name),
        root,
        entry.name,
      );
      children.push(child);
    }

    return { name, path: relPath, type: 'directory', children };
  }

  // ── 통계 (.versions 제외) ─────────────────────────────────────────────────

  async getStats(projectName: string): Promise<ProjectStats> {
    const dir = this.projectPath(projectName);
    let fileCount = 0;
    let totalSize = 0;

    const stack: string[] = [dir];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      let entries;
      try {
        entries = await fs.readdir(cur, { withFileTypes: true });
      } catch (err) {
        this.logger.warn(
          `getStats: readdir 실패 — ${cur}`,
          (err as Error).message,
        );
        continue;
      }
      for (const entry of entries) {
        if (entry.name === VERSIONS_DIR) continue; // .versions 제외
        const full = path.join(cur, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
        } else if (entry.isFile()) {
          fileCount++;
          try {
            const st = await fs.stat(full);
            totalSize += st.size;
          } catch (err) {
            this.logger.warn(
              `getStats: stat 실패 — ${full}`,
              (err as Error).message,
            );
          }
        }
      }
    }

    return { fileCount, totalSize };
  }

  // ── 아카이브 다운로드 ──────────────────────────────────────────────────────

  async archiveProject(projectName: string): Promise<Readable> {
    const dir = this.projectPath(projectName);
    await fs.access(dir);

    const tar = spawn(
      'tar',
      ['-czf', '-', '-C', dir, '--exclude', `./${VERSIONS_DIR}`, '.'],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );

    tar.stderr.on('data', (chunk) => {
      this.logger.warn(`tar stderr: ${chunk.toString()}`);
    });
    tar.on('error', (err) => {
      this.logger.error('tar spawn error', err);
    });

    return tar.stdout;
  }

  // ── 버전 히스토리 ──────────────────────────────────────────────────────────

  async createSnapshot(projectName: string): Promise<ProjectVersion> {
    const dir = this.projectPath(projectName);
    const versionsDir = path.join(dir, VERSIONS_DIR);
    await fs.mkdir(versionsDir, { recursive: true });

    const now = new Date();
    const id = now.toISOString().replace(/[:.]/g, '-');
    const filename = `${id}.tar.gz`;
    const dest = path.join(versionsDir, filename);

    await new Promise<void>((resolve, reject) => {
      const tar = spawn(
        'tar',
        ['-czf', dest, '-C', dir, '--exclude', `./${VERSIONS_DIR}`, '.'],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
      tar.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`tar exited with code ${code}`));
      });
      tar.on('error', reject);
    });

    const stat = await fs.stat(dest);
    return { id, createdAt: now, compressedSize: stat.size, filename };
  }

  async listVersions(projectName: string): Promise<ProjectVersion[]> {
    const dir = this.projectPath(projectName);
    const versionsDir = path.join(dir, VERSIONS_DIR);

    let entries: string[];
    try {
      entries = await fs.readdir(versionsDir);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        this.logger.warn(
          `listVersions: readdir 실패 — ${versionsDir}`,
          (err as Error).message,
        );
      }
      return [];
    }

    const versions: ProjectVersion[] = [];
    for (const filename of entries) {
      if (!filename.endsWith('.tar.gz')) continue;
      const id = filename.replace(/\.tar\.gz$/, '');
      const fullPath = path.join(versionsDir, filename);
      try {
        const stat = await fs.stat(fullPath);
        versions.push({
          id,
          createdAt: stat.mtime,
          compressedSize: stat.size,
          filename,
        });
      } catch (err) {
        this.logger.warn(
          `listVersions: stat 실패 — ${fullPath}`,
          (err as Error).message,
        );
      }
    }

    // 최신순 정렬
    return versions.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  async cleanupVersions(projectName: string, keepCount = 1): Promise<number> {
    const versions = await this.listVersions(projectName);
    if (versions.length <= keepCount) return 0;

    const toDelete = versions.slice(keepCount);
    const dir = this.projectPath(projectName);
    const versionsDir = path.join(dir, VERSIONS_DIR);
    let deleted = 0;

    for (const v of toDelete) {
      try {
        await fs.unlink(path.join(versionsDir, v.filename));
        deleted++;
      } catch (err) {
        this.logger.warn(
          `cleanupVersions: unlink 실패 — ${v.filename}`,
          (err as Error).message,
        );
      }
    }
    return deleted;
  }

  async readFileAtVersion(
    projectName: string,
    versionId: string,
    relativePath: string,
  ): Promise<Buffer | null> {
    const dir = this.projectPath(projectName);
    const versionsDir = path.join(dir, VERSIONS_DIR);
    const safeVersion = path.basename(versionId);
    const src = path.join(versionsDir, `${safeVersion}.tar.gz`);

    try {
      await fs.access(src);
    } catch {
      throw new Error(`version archive not found: ${safeVersion}`);
    }

    // tar는 항목을 ./경로 형태로 저장하므로 ./경로와 경로 두 가지를 모두 시도한다.
    const normalized = relativePath.replace(/^\.\//, '').replace(/^\/+/, '');
    const candidates = [`./${normalized}`, normalized];

    for (const target of candidates) {
      const buffer = await this.extractSingleFileFromTar(src, target);
      if (buffer !== null) return buffer;
    }
    return null;
  }

  private extractSingleFileFromTar(
    archivePath: string,
    entryPath: string,
  ): Promise<Buffer | null> {
    return new Promise((resolve) => {
      const tar = spawn('tar', ['-xOzf', archivePath, entryPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const chunks: Buffer[] = [];
      let stderrOutput = '';

      tar.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
      tar.stderr.on('data', (chunk: Buffer) => {
        stderrOutput += chunk.toString();
      });
      tar.on('error', () => resolve(null));
      tar.on('exit', (code) => {
        if (code === 0 && chunks.length > 0) {
          resolve(Buffer.concat(chunks));
        } else {
          if (stderrOutput && !stderrOutput.includes('Not found in archive')) {
            this.logger.warn(
              `extractSingleFileFromTar: ${entryPath} — ${stderrOutput.trim()}`,
            );
          }
          resolve(null);
        }
      });
    });
  }

  async restoreVersion(projectName: string, versionId: string): Promise<void> {
    const dir = this.projectPath(projectName);
    const versionsDir = path.join(dir, VERSIONS_DIR);
    const safe = path.basename(versionId);
    const src = path.join(versionsDir, `${safe}.tar.gz`);

    // 기존 파일 삭제 (.versions 제외)
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === VERSIONS_DIR) continue;
      await fs.rm(path.join(dir, entry.name), { recursive: true, force: true });
    }

    // 복원
    await new Promise<void>((resolve, reject) => {
      const tar = spawn('tar', ['-xzf', src, '-C', dir], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      tar.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`tar restore exited with code ${code}`));
      });
      tar.on('error', reject);
    });
  }
}
