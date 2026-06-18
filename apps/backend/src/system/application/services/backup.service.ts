import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

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
    const date = new Date()
      .toISOString()
      .replace(/T/, '_')
      .replace(/:/g, '-')
      .slice(0, 19);

    const backupDir = path.join(BACKUP_ROOT, containerName, date);
    fs.mkdirSync(backupDir, { recursive: true });

    const dumpName = `dump_${date}`;
    const env = `DOCKER_HOST=${DOCKER_HOST}`;

    this.logger.log(`백업 시작: ${containerName} → ${backupDir}`);

    // 1. 컨테이너 내부 mongodump
    await execAsync(
      `${env} docker exec ${containerName} mongodump --db kscold-blog --out /tmp/${dumpName} --quiet`,
    );

    // 2. 호스트로 복사
    await execAsync(
      `${env} docker cp ${containerName}:/tmp/${dumpName} ${backupDir}/`,
    );

    // 3. 컨테이너 임시 파일 정리
    await execAsync(
      `${env} docker exec ${containerName} rm -rf /tmp/${dumpName}`,
    ).catch(() => {}); // 실패해도 무시

    // 4. 크기 계산
    const { stdout } = await execAsync(`du -sh "${backupDir}" | cut -f1`);
    const size = stdout.trim();

    this.logger.log(`백업 완료: ${backupDir} (${size})`);
    return { path: backupDir, size };
  }

  listBackups(
    containerName: string,
  ): { date: string; path: string; size: string }[] {
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
          const result = require('child_process').execSync(
            `du -sh "${fullPath}" | cut -f1`,
          );
          size = result.toString().trim();
        } catch {
          // du 실패 시 기본값 '-' 유지
        }
        return { date: e.name, path: fullPath, size };
      });
  }
}
