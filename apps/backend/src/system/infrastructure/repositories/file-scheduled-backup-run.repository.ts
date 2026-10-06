import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { isValidScheduledBackupTargetName } from '../../domain/policies/scheduled-backup.policy';
import type { IScheduledBackupRunRepository } from '../../domain/repositories/scheduled-backup-run.repository';
import type { ScheduledBackupRun } from '../../domain/types/scheduled-backup.type';
import { MONGODB_BACKUP_ROOT } from './mongodb-backup-root';

const LAST_RUN_FILE_NAME = 'last-run.json';

/** 예약 백업의 마지막 실행 결과를 대상 디렉터리 안 JSON 파일로 보관한다. */
@Injectable()
export class FileScheduledBackupRunRepository implements IScheduledBackupRunRepository {
  protected readonly backupRoot: string = MONGODB_BACKUP_ROOT;

  findLatest(targetName: string): ScheduledBackupRun | null {
    try {
      return JSON.parse(
        fs.readFileSync(this.filePath(targetName), 'utf8'),
      ) as ScheduledBackupRun;
    } catch {
      // 아직 실행된 적이 없거나 파일이 손상된 경우 모두 "기록 없음"으로 본다.
      return null;
    }
  }

  save(run: ScheduledBackupRun): void {
    const filePath = this.filePath(run.target);
    fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(filePath, JSON.stringify(run, null, 2), { mode: 0o600 });
  }

  private filePath(targetName: string): string {
    if (!isValidScheduledBackupTargetName(targetName)) {
      throw new Error(`허용되지 않은 예약 백업 대상 이름입니다: ${targetName}`);
    }
    return path.join(this.backupRoot, targetName, LAST_RUN_FILE_NAME);
  }
}
