import {
  StorageTrimSchedulerService,
  storageTrimSchedule,
} from '@/maintenance/application/services/storage-trim-scheduler.service';
import {
  GetAutomationsUseCase,
  GetStorageOverviewUseCase,
  TrimDockerDiskUseCase,
  automationSettings,
} from '@/maintenance/application/use-cases';
import type { GetWorktreeCleanupOverviewUseCase } from '@/maintenance/application/use-cases/get-worktree-cleanup-overview.use-case';
import type { IAutomationInspectionGateway } from '@/maintenance/domain/repositories/automation-inspection.gateway';
import type { IStorageInspectionGateway } from '@/maintenance/domain/repositories/storage-inspection.gateway';
import { trimRunRepository } from '../storage-trim-run.fake';

const GiB = 1024 ** 3;

function storageGateway(
  trimDockerDisk: () => Promise<string>,
): IStorageInspectionGateway {
  return {
    hostDisk: jest.fn(),
    dockerVmDiskPath: () => '/home/example/vm/datadisk',
    dockerVmAllocatedBytes: jest
      .fn()
      .mockResolvedValueOnce(30 * GiB)
      .mockResolvedValue(25 * GiB),
    dockerVmUsedBytes: jest.fn(),
    heldDeletedFiles: jest.fn(),
    dockerUsage: jest.fn(),
    folderSize: jest.fn(),
    trimDockerDisk: jest.fn(trimDockerDisk),
  };
}

function trimUseCase(trimDockerDisk: () => Promise<string>) {
  const gateway = storageGateway(trimDockerDisk);
  const runs = trimRunRepository();
  const trim = new TrimDockerDiskUseCase(
    gateway,
    runs,
    new GetStorageOverviewUseCase(gateway),
  );
  return { trim, runs };
}

describe('공간 반환 기록과 예약', () => {
  const originalTime = process.env.STORAGE_TRIM_TIME;

  afterEach(() => {
    jest.useRealTimers();
    if (originalTime === undefined) delete process.env.STORAGE_TRIM_TIME;
    else process.env.STORAGE_TRIM_TIME = originalTime;
  });

  it('버튼으로 돌린 공간 반환은 누가 돌렸는지와 돌려준 크기를 남기고, 실패도 기록한다', async () => {
    const ok = trimUseCase(
      async () => '/var/lib/docker: 5 GiB (5368709120 bytes) trimmed',
    );
    await ok.trim.execute({ actorEmail: 'admin@example.com' });
    const [succeeded] = await ok.runs.listRecent(1);
    expect(succeeded).toMatchObject({
      trigger: 'manual',
      status: 'succeeded',
      actorEmail: 'admin@example.com',
      allocatedBeforeBytes: 30 * GiB,
      allocatedAfterBytes: 25 * GiB,
      message: '맥에 5.0 GiB를 돌려줬습니다.',
    });

    const failing = trimUseCase(async () => {
      throw new Error('colima 응답 없음');
    });
    await expect(failing.trim.execute()).rejects.toThrow('colima 응답 없음');
    const [failed] = await failing.runs.listRecent(1);
    expect(failed).toMatchObject({
      status: 'failed',
      message: 'colima 응답 없음',
    });
    expect(failing.trim.isRunning()).toBe(false);
  });

  it('서버를 띄운 직후에는 지나간 예약을 돌리지 않고, 다음 예약 시각에 한 번만 돌린다', async () => {
    delete process.env.STORAGE_TRIM_TIME;
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    // 서울 시각 2026-10-29 11:00
    jest.setSystemTime(new Date('2026-10-29T02:00:00.000Z'));
    const { trim, runs } = trimUseCase(async () => '');
    const scheduler = new StorageTrimSchedulerService(runs, trim);

    await expect(scheduler.runIfDue(new Date())).resolves.toBe(false);
    expect(await scheduler.nextRunAt(new Date())).toEqual(
      new Date('2026-10-29T20:00:00.000Z'),
    );

    // 서울 시각 2026-10-30 05:01
    jest.setSystemTime(new Date('2026-10-29T20:01:00.000Z'));
    await expect(scheduler.runIfDue(new Date())).resolves.toBe(true);
    jest.setSystemTime(new Date('2026-10-29T20:02:00.000Z'));
    await expect(scheduler.runIfDue(new Date())).resolves.toBe(false);
    expect((await runs.listRecent(5)).map((run) => run.trigger)).toEqual([
      'schedule',
    ]);
  });

  it('STORAGE_TRIM_TIME 으로 시각을 바꾸고 off 로 자동 실행을 끈다', () => {
    expect(storageTrimSchedule({})).toEqual({
      enabled: true,
      scheduleTime: '05:00',
    });
    expect(storageTrimSchedule({ STORAGE_TRIM_TIME: '06:15' })).toEqual({
      enabled: true,
      scheduleTime: '06:15',
    });
    expect(storageTrimSchedule({ STORAGE_TRIM_TIME: 'off' }).enabled).toBe(
      false,
    );
  });
});

describe('자동 작업 현황', () => {
  function worktreeOverview(): GetWorktreeCleanupOverviewUseCase {
    return {
      execute: jest.fn().mockResolvedValue({
        timeZone: 'Asia/Seoul',
        items: [
          {
            target: {
              id: 't1',
              name: 'projectbeta',
              description: '',
              rootPath: '/home/example/projectbeta/.worktrees',
              scheduleTime: '04:30',
              enabled: true,
            },
            running: false,
            nextRunAt: null,
            lastRun: {
              status: 'success',
              message: '작업 폴더 2개를 정리했습니다.',
              startedAt: new Date('2026-10-28T19:30:00.000Z'),
            },
          },
        ],
      }),
    } as unknown as GetWorktreeCleanupOverviewUseCase;
  }

  it('Control 예약 작업, 맥 자동 실행 작업, 컨테이너 안 정리를 한 목록으로 보여준다', async () => {
    const gateway: IAutomationInspectionGateway = {
      listLaunchdJobs: jest.fn().mockResolvedValue([
        {
          label: 'com.example.watchdog',
          domain: 'gui',
          program: 'watchdog.sh',
          schedule: {
            calendar: [],
            intervalSeconds: 600,
            runAtLoad: false,
            keepAlive: false,
            launchOnlyOnce: false,
          },
          loaded: true,
          running: false,
          lastExitCode: 1,
          logUpdatedAt: new Date('2026-10-29T02:10:00.000Z'),
          lastLogLine: '복구 실패',
        },
      ]),
      inspectReleaseDir: jest.fn().mockResolvedValue({
        count: 2,
        sizeBytes: 1.7 * GiB,
        lastDeployedAt: new Date('2026-10-29T00:54:42.000Z'),
      }),
    };
    const settings = automationSettings({
      AUTOMATION_LAUNCHD_PREFIXES: 'com.example.',
      AUTOMATION_DESCRIPTIONS: JSON.stringify({
        'com.example.watchdog': {
          name: '감시',
          description: '서비스 감시·자동 복구',
        },
      }),
      AUTOMATION_RELEASE_DIRS: JSON.stringify([
        { label: '배포 릴리스', container: 'app', path: '/releases', keep: 2 },
      ]),
    });

    const overview = await new GetAutomationsUseCase(
      gateway,
      trimRunRepository(),
      worktreeOverview(),
    ).execute(settings);

    expect(gateway.listLaunchdJobs).toHaveBeenCalledWith(['com.example.']);
    expect(
      overview.jobs.map(({ key, kind, health, schedule }) => ({
        key,
        kind,
        health,
        schedule,
      })),
    ).toEqual([
      {
        key: 'worktree:t1',
        kind: 'control',
        health: 'ok',
        schedule: '매일 04:30',
      },
      {
        key: 'storage-trim',
        kind: 'control',
        health: 'unknown',
        schedule: '매일 05:00',
      },
      {
        key: 'launchd:com.example.watchdog',
        kind: 'launchd',
        health: 'failed',
        schedule: '10분마다',
      },
      {
        key: 'release:app:/releases',
        kind: 'container',
        health: 'ok',
        schedule: '배포가 성공할 때마다',
      },
    ]);
    expect(overview.jobs[2]).toMatchObject({
      name: '감시',
      description: '서비스 감시·자동 복구',
      lastMessage: '마지막 종료 코드 1 · 복구 실패',
    });
    expect(overview.jobs[3].lastMessage).toBe(
      '지금 2개 · 1.7 GiB · 남기는 기준 2개',
    );
    expect(overview.warnings).toEqual([]);
  });

  it('맥 작업을 못 읽어도 나머지는 보여주고 이유를 남긴다', async () => {
    const gateway: IAutomationInspectionGateway = {
      listLaunchdJobs: jest.fn().mockRejectedValue(new Error('launchctl 없음')),
      inspectReleaseDir: jest.fn(),
    };

    const overview = await new GetAutomationsUseCase(
      gateway,
      trimRunRepository(),
      worktreeOverview(),
    ).execute(
      automationSettings({ AUTOMATION_LAUNCHD_PREFIXES: 'com.example.' }),
    );

    expect(overview.jobs.map((job) => job.key)).toEqual([
      'worktree:t1',
      'storage-trim',
    ]);
    expect(overview.warnings).toEqual(['맥 자동 실행 작업: launchctl 없음']);
  });
});
