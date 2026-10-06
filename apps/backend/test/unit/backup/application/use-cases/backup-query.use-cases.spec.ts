import { Logger } from '@nestjs/common';
import {
  GetBackupOverviewUseCase,
  ListBackupRunsUseCase,
  RunBackupTargetUseCase,
} from '@/backup/application/use-cases';
import type { BackupRun } from '@/backup/domain/entities/backup-run.entity';
import type { BackupTarget } from '@/backup/domain/entities/backup-target.entity';

describe('백업 조회·실행 유스케이스', () => {
  const now = new Date('2026-10-06T06:00:00.000Z');
  const appTarget = {
    id: 'target-1',
    name: 'app-prod',
    enabled: true,
    scheduleTime: '03:30',
    scheduleCursorAt: new Date('2026-10-05T18:30:00.000Z'),
  } as BackupTarget;
  const pausedTarget = {
    id: 'target-2',
    name: 'paused-prod',
    enabled: false,
    scheduleTime: '05:00',
    scheduleCursorAt: new Date('2026-10-01T00:00:00.000Z'),
  } as BackupTarget;
  const lastRun = { id: 'run-1', targetId: 'target-1' } as BackupRun;
  const archive = {
    name: '2026-10-05_18-30-02',
    takenAt: new Date('2026-10-05T18:30:02.000Z'),
    path: '/backups/app-prod/2026-10-05_18-30-02',
    sizeBytes: 204800,
  };

  const targetRepository = { findAll: jest.fn() };
  const runRepository = {
    findLatestByTargetIds: jest.fn(),
    findRecent: jest.fn(),
  };
  const archiveRepository = { list: jest.fn() };
  const runner = { isRunning: jest.fn(), start: jest.fn() };

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    targetRepository.findAll.mockResolvedValue([appTarget, pausedTarget]);
    runRepository.findLatestByTargetIds.mockResolvedValue(
      new Map([['target-1', lastRun]]),
    );
    archiveRepository.list.mockResolvedValue([]);
    runner.isRunning.mockReturnValue(false);
  });

  describe('현황 조회', () => {
    const useCase = new GetBackupOverviewUseCase(
      targetRepository as never,
      runRepository as never,
      archiveRepository as never,
      runner as never,
    );

    it('대상별 일정·최근 실행·보관 중인 백업을 모아 돌려준다', async () => {
      archiveRepository.list.mockImplementation((name: string) =>
        Promise.resolve(name === 'app-prod' ? [archive] : []),
      );
      runner.isRunning.mockImplementation((id: string) => id === 'target-1');

      const overview = await useCase.execute(now);

      expect(overview.timeZone).toBe('Asia/Seoul');
      expect(runRepository.findLatestByTargetIds).toHaveBeenCalledWith([
        'target-1',
        'target-2',
      ]);
      expect(overview.items).toEqual([
        {
          target: appTarget,
          running: true,
          // 오늘 실행을 마쳤으므로 내일 03:30 KST
          nextRunAt: new Date('2026-10-06T18:30:00.000Z'),
          lastRun,
          archives: [archive],
        },
        {
          target: pausedTarget,
          running: false,
          nextRunAt: null,
          lastRun: null,
          archives: [],
        },
      ]);
    });

    it('한 대상의 디스크 조회가 실패해도 나머지는 그대로 보여준다', async () => {
      archiveRepository.list.mockImplementation((name: string) =>
        name === 'app-prod'
          ? Promise.reject(new Error('권한 없음'))
          : Promise.resolve([archive]),
      );

      const overview = await useCase.execute(now);

      expect(overview.items[0].archives).toEqual([]);
      expect(overview.items[1].archives).toEqual([archive]);
    });

    it('등록된 대상이 없으면 빈 목록을 돌려준다', async () => {
      targetRepository.findAll.mockResolvedValueOnce([]);
      runRepository.findLatestByTargetIds.mockResolvedValueOnce(new Map());

      await expect(useCase.execute(now)).resolves.toEqual({
        timeZone: 'Asia/Seoul',
        items: [],
      });
    });
  });

  describe('지금 실행', () => {
    it('요청한 사용자를 남기고 수동 실행을 시작한다', async () => {
      const run = { id: 'run-2', status: 'running' } as BackupRun;
      runner.start.mockResolvedValueOnce(run);
      const actor = { id: 'user-1', email: 'admin@example.com' };

      await expect(
        new RunBackupTargetUseCase(runner as never).execute('target-1', actor),
      ).resolves.toBe(run);
      expect(runner.start).toHaveBeenCalledWith('target-1', 'manual', actor);
    });
  });

  describe('이력 조회', () => {
    const useCase = new ListBackupRunsUseCase(runRepository as never);

    it('건수를 지정하지 않으면 최근 30건을 조회한다', async () => {
      runRepository.findRecent.mockResolvedValueOnce([lastRun]);

      await expect(useCase.execute()).resolves.toEqual([lastRun]);
      expect(runRepository.findRecent).toHaveBeenCalledWith({
        targetId: undefined,
        limit: 30,
      });
    });

    it('대상과 건수를 지정해 조회한다', async () => {
      runRepository.findRecent.mockResolvedValueOnce([]);

      await useCase.execute({ targetId: 'target-1', limit: 5 });

      expect(runRepository.findRecent).toHaveBeenCalledWith({
        targetId: 'target-1',
        limit: 5,
      });
    });
  });
});
