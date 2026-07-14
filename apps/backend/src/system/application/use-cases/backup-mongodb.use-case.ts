import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
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

/** 지정 컨테이너의 MongoDB(kscold-blog) 백업 수행 */
@Injectable()
export class BackupMongodbUseCase {
  private readonly logger = new Logger(BackupMongodbUseCase.name);

  async execute(
    containerName: string,
  ): Promise<{ path: string; size: string }> {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(containerName)) {
      throw new BadRequestException('잘못된 컨테이너 이름입니다.');
    }

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
}
