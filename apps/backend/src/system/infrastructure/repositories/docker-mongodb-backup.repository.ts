import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type {
  IMongodbBackupRepository,
  MongodbBackupEntry,
  MongodbBackupResult,
} from '../../domain/repositories/mongodb-backup.repository';

const execFileAsync = promisify(execFile);
const BACKUP_ROOT = path.join(
  process.env.HOME || '/Users/kscold',
  'Desktop',
  'server-logs',
  'mongodb-backups',
);
const DOCKER_HOST =
  process.env.DOCKER_HOST || 'unix:///Users/kscold/.colima/default/docker.sock';

@Injectable()
export class DockerMongodbBackupRepository implements IMongodbBackupRepository {
  private readonly logger = new Logger(DockerMongodbBackupRepository.name);

  async create(containerName: string): Promise<MongodbBackupResult> {
    const date = new Date()
      .toISOString()
      .replace(/T/, '_')
      .replace(/:/g, '-')
      .slice(0, 19);
    const backupDir = path.join(BACKUP_ROOT, containerName, date);
    const dumpName = `dump_${date}`;
    const env = { ...process.env, DOCKER_HOST };

    fs.mkdirSync(backupDir, { recursive: true });
    this.logger.log(`백업 시작: ${containerName} → ${backupDir}`);

    await execFileAsync(
      'docker',
      [
        'exec',
        containerName,
        'mongodump',
        '--db',
        'kscold-blog',
        '--out',
        `/tmp/${dumpName}`,
        '--quiet',
      ],
      { env },
    );
    await execFileAsync(
      'docker',
      ['cp', `${containerName}:/tmp/${dumpName}`, `${backupDir}/`],
      { env },
    );
    await execFileAsync(
      'docker',
      ['exec', containerName, 'rm', '-rf', `/tmp/${dumpName}`],
      { env },
    ).catch(() => undefined);

    const { stdout } = await execFileAsync('du', ['-sh', backupDir]);
    const size = stdout.trim().split(/\s+/)[0] ?? '-';
    this.logger.log(`백업 완료: ${backupDir} (${size})`);
    return { path: backupDir, size };
  }

  async list(containerName: string): Promise<MongodbBackupEntry[]> {
    const containerDir = path.join(BACKUP_ROOT, containerName);
    if (!fs.existsSync(containerDir)) {
      return [];
    }

    return Promise.all(
      fs
        .readdirSync(containerDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .sort((left, right) => right.name.localeCompare(left.name))
        .map(async (entry) => {
          const backupPath = path.join(containerDir, entry.name);
          let size = '-';
          try {
            const { stdout } = await execFileAsync('du', ['-sh', backupPath]);
            size = stdout.trim().split(/\s+/)[0] ?? '-';
          } catch {
            // A size lookup must not hide an otherwise valid backup.
          }
          return { date: entry.name, path: backupPath, size };
        }),
    );
  }
}
