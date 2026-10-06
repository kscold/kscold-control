import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ScheduledBackupRun } from '@/system/domain/types/scheduled-backup.type';
import { FileScheduledBackupRunRepository } from '@/system/infrastructure/repositories/file-scheduled-backup-run.repository';

describe('FileScheduledBackupRunRepository', () => {
  const run: ScheduledBackupRun = {
    target: 'app-prod',
    trigger: 'schedule',
    startedAt: '2026-10-06T18:30:00.000Z',
    finishedAt: '2026-10-06T18:30:04.000Z',
    success: true,
    message: '백업을 완료했습니다.',
    path: '/backups/app-prod/2026-10-06_18-30-00',
    size: '1.2M',
    pruned: [],
  };

  let backupRoot: string;
  let repository: FileScheduledBackupRunRepository;

  beforeEach(() => {
    backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'scheduled-run-'));
    const root = backupRoot;
    repository = new (class extends FileScheduledBackupRunRepository {
      protected readonly backupRoot = root;
    })();
  });

  afterEach(() => {
    fs.rmSync(backupRoot, { recursive: true, force: true });
  });

  it('저장한 실행 결과를 다시 읽는다', () => {
    repository.save(run);

    expect(repository.findLatest('app-prod')).toEqual(run);
    const filePath = path.join(backupRoot, 'app-prod', 'last-run.json');
    expect(fs.statSync(filePath).mode & 0o777).toBe(0o600);
  });

  it('새 결과가 이전 결과를 덮어쓴다', () => {
    repository.save(run);
    repository.save({
      ...run,
      success: false,
      message: '백업 실패: 연결 실패',
    });

    expect(repository.findLatest('app-prod')).toMatchObject({
      success: false,
      message: '백업 실패: 연결 실패',
    });
  });

  it('실행된 적이 없으면 null 을 돌려준다', () => {
    expect(repository.findLatest('app-prod')).toBeNull();
  });

  it('기록 파일이 손상됐으면 null 을 돌려준다', () => {
    fs.mkdirSync(path.join(backupRoot, 'app-prod'));
    fs.writeFileSync(
      path.join(backupRoot, 'app-prod', 'last-run.json'),
      '{"target":',
    );

    expect(repository.findLatest('app-prod')).toBeNull();
  });

  it('허용되지 않은 대상 이름으로는 파일을 만들지 않는다', () => {
    expect(() => repository.save({ ...run, target: '../escape' })).toThrow(
      '허용되지 않은 예약 백업 대상 이름',
    );
    expect(repository.findLatest('../escape')).toBeNull();
    expect(fs.readdirSync(backupRoot)).toEqual([]);
  });
});
