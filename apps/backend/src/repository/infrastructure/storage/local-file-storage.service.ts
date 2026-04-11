import { Injectable, Logger } from '@nestjs/common';
import { promises as fs, createReadStream } from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { spawn } from 'child_process';
import {
  FileTreeNode,
  IFileStorage,
  ProjectStats,
} from '../../domain/repositories/file-storage.interface';

@Injectable()
export class LocalFileStorageService implements IFileStorage {
  private readonly logger = new Logger(LocalFileStorageService.name);
  private readonly baseDir: string;

  constructor() {
    this.baseDir = process.env.REPOSITORY_STORAGE_DIR ?? '/var/repos';
  }

  private projectPath(projectName: string): string {
    const safe = path.basename(projectName);
    return path.join(this.baseDir, safe);
  }

  async ensureProject(projectName: string): Promise<void> {
    const dir = this.projectPath(projectName);
    await fs.mkdir(dir, { recursive: true });
  }

  async writeFile(projectName: string, relativePath: string, buffer: Buffer): Promise<void> {
    const dir = this.projectPath(projectName);
    const target = path.join(dir, relativePath);

    const resolved = path.resolve(target);
    if (!resolved.startsWith(path.resolve(dir))) {
      throw new Error(`Path traversal blocked: ${relativePath}`);
    }

    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);
  }

  async removeProject(projectName: string): Promise<void> {
    const dir = this.projectPath(projectName);
    await fs.rm(dir, { recursive: true, force: true });
  }

  async listTree(projectName: string): Promise<FileTreeNode> {
    const root = this.projectPath(projectName);
    return this.walk(root, root, projectName);
  }

  private async walk(currentPath: string, root: string, name: string): Promise<FileTreeNode> {
    const stats = await fs.stat(currentPath);
    const relPath = path.relative(root, currentPath) || '';

    if (stats.isFile()) {
      return {
        name,
        path: relPath,
        type: 'file',
        size: stats.size,
      };
    }

    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    const children: FileTreeNode[] = [];
    for (const entry of entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    })) {
      const child = await this.walk(path.join(currentPath, entry.name), root, entry.name);
      children.push(child);
    }

    return {
      name,
      path: relPath,
      type: 'directory',
      children,
    };
  }

  async readFile(projectName: string, relativePath: string): Promise<Buffer> {
    const dir = this.projectPath(projectName);
    const target = path.resolve(path.join(dir, relativePath));
    if (!target.startsWith(path.resolve(dir))) {
      throw new Error(`Path traversal blocked: ${relativePath}`);
    }
    return fs.readFile(target);
  }

  async archiveProject(projectName: string): Promise<Readable> {
    const dir = this.projectPath(projectName);
    await fs.access(dir);

    const tar = spawn('tar', ['-czf', '-', '-C', dir, '.'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    tar.stderr.on('data', (chunk) => {
      this.logger.warn(`tar stderr: ${chunk.toString()}`);
    });

    tar.on('error', (err) => {
      this.logger.error(`tar spawn error`, err);
    });

    return tar.stdout;
  }

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
      } catch {
        continue;
      }
      for (const entry of entries) {
        const full = path.join(cur, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
        } else if (entry.isFile()) {
          fileCount++;
          try {
            const st = await fs.stat(full);
            totalSize += st.size;
          } catch {}
        }
      }
    }

    return { fileCount, totalSize };
  }

  async createReadStream(projectName: string, relativePath: string): Promise<Readable> {
    const dir = this.projectPath(projectName);
    const target = path.resolve(path.join(dir, relativePath));
    if (!target.startsWith(path.resolve(dir))) {
      throw new Error(`Path traversal blocked: ${relativePath}`);
    }
    return createReadStream(target);
  }
}
