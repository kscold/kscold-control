import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { execFile, execFileSync } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

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
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  async backupMongodb(
    containerName: string,
  ): Promise<{ path: string; size: string }> {
    this.assertSafeContainerName(containerName);
    const date = new Date()
      .toISOString()
      .replace(/T/, '_')
      .replace(/:/g, '-')
      .slice(0, 19);

    const backupDir = path.join(BACKUP_ROOT, containerName, date);
    fs.mkdirSync(backupDir, { recursive: true });

    const dumpName = `dump_${date}`;
    const env = { ...process.env, DOCKER_HOST };

    this.logger.log(`백업 시작: ${containerName} → ${backupDir}`);

    // 1. 컨테이너 내부 mongodump
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

    // 2. 호스트로 복사
    await execFileAsync(
      'docker',
      ['cp', `${containerName}:/tmp/${dumpName}`, `${backupDir}/`],
      { env },
    );

    // 3. 컨테이너 임시 파일 정리
    await execFileAsync(
      'docker',
      ['exec', containerName, 'rm', '-rf', `/tmp/${dumpName}`],
      { env },
    ).catch(() => {}); // 실패해도 무시

    // 4. 크기 계산
    const { stdout } = await execFileAsync('du', ['-sh', backupDir]);
    const size = stdout.trim().split(/\s+/)[0] ?? '-';

    this.logger.log(`백업 완료: ${backupDir} (${size})`);
    return { path: backupDir, size };
  }

  listBackups(
    containerName: string,
  ): { date: string; path: string; size: string }[] {
    this.assertSafeContainerName(containerName);
    const containerDir = path.join(BACKUP_ROOT, containerName);
    if (!fs.existsSync(containerDir)) return [];

    return fs
      .readdirSync(containerDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .sort((a, b) => b.name.localeCompare(a.name)) // 최신순
      .map((e) => {
        const fullPath = path.join(containerDir, e.name);
        let size = '-';
        try {
          const result = execFileSync('du', ['-sh', fullPath]);
          size = result.toString().trim().split(/\s+/)[0] ?? '-';
        } catch {
          // du 실패 시 기본값 '-' 유지
        }
        return { date: e.name, path: fullPath, size };
      });
  }

  private assertSafeContainerName(containerName: string): void {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(containerName)) {
      throw new BadRequestException('잘못된 컨테이너 이름입니다.');
    }
  }
}
