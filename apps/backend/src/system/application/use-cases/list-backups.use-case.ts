import { BadRequestException, Injectable } from '@nestjs/common';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const BACKUP_ROOT = path.join(
  process.env.HOME || '/Users/kscold',
  'Desktop',
  'server-logs',
  'mongodb-backups',
);

/** 지정 컨테이너의 MongoDB 백업 목록 조회 */
@Injectable()
export class ListBackupsUseCase {
  execute(
    containerName: string,
  ): { date: string; path: string; size: string }[] {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(containerName)) {
      throw new BadRequestException('잘못된 컨테이너 이름입니다.');
    }

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
}
