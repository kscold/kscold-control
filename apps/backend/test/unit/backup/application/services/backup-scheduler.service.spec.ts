import { Logger } from '@nestjs/common';
import { BackupSchedulerService } from '@/backup/application/services/backup-scheduler.service';
import type { BackupTarget } from '@/backup/domain/entities/backup-target.entity';

describe('BackupSchedulerService', () => {
  // 한국 시각 2026-10-06 03:30 = UTC 2026-10-05 18:30
  const now = new Date('2026-10-05T18:30:10.000Z');
  const beforeOccurrence = new Date('2026-10-05T10:00:00.000Z');

  function buildTarget(overrides: Partial<BackupTarget>): BackupTarget {
    return {
      id: 'target-1',
      name: 'app-prod',
      enabled: true,
      scheduleTime: '03:30',
      scheduleCursorAt: beforeOccurrence,
      ...overrides,
    } as BackupTarget;
  }

  const targetRepository = {
    findEnabled: jest.fn(),
    moveScheduleCursor: jest.fn(),
  };
  const runner = { isRunning: jest.fn(), runToCompletion: jest.fn() };
  let service: BackupSchedulerService;

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    runner.isRunning.mockReturnValue(false);
    runner.runToCompletion.mockResolvedValue({ status: 'success' });
    service = new BackupSchedulerService(
      targetRepository as never,
      runner as never,
    );
  });

  it('1분마다 점검하도록 등록한다', () => {
    expect(
      Reflect.getMetadata(
        'SCHEDULE_CRON_OPTIONS',
        BackupSchedulerService.prototype.handleTick,
      ),
    ).toMatchObject({ cronTime: '*/1 * * * *' });
  });

  it('차례가 된 대상만 백업한다', async () => {
    targetRepository.findEnabled.mockResolvedValueOnce([
      buildTarget({ id: 'due', name: 'due-prod' }),
      // 실행 시각이 아직 오지 않은 대상 (KST 23:00)
      buildTarget({
        id: 'later',
        name: 'later-prod',
        scheduleTime: '23:00',
        scheduleCursorAt: new Date('2026-10-05T15:00:00.000Z'),
      }),
    ]);

    await expect(service.runDueTargets(now)).resolves.toBe(1);

    expect(runner.runToCompletion).toHaveBeenCalledTimes(1);
    expect(runner.runToCompletion).toHaveBeenCalledWith('due', 'schedule');
  });

  it('덤프를 시작하기 전에 예약 기준 시각을 먼저 옮긴다', async () => {
    targetRepository.findEnabled.mockResolvedValueOnce([buildTarget({})]);
    const order: string[] = [];
    targetRepository.moveScheduleCursor.mockImplementationOnce(() => {
      order.push('cursor');
      return Promise.resolve();
    });
    runner.runToCompletion.mockImplementationOnce(() => {
      order.push('run');
      return Promise.resolve({ status: 'success' });
    });

    await service.runDueTargets(now);

    expect(order).toEqual(['cursor', 'run']);
    expect(targetRepository.moveScheduleCursor).toHaveBeenCalledWith(
      'target-1',
      now,
    );
  });

  it('수동 실행이 진행 중인 대상은 건너뛰고 기준 시각도 그대로 둔다', async () => {
    targetRepository.findEnabled.mockResolvedValueOnce([buildTarget({})]);
    runner.isRunning.mockReturnValueOnce(true);

    await expect(service.runDueTargets(now)).resolves.toBe(0);

    expect(targetRepository.moveScheduleCursor).not.toHaveBeenCalled();
    expect(runner.runToCompletion).not.toHaveBeenCalled();
  });

  it('한 대상을 시작하지 못해도 다음 대상은 계속 백업한다', async () => {
    targetRepository.findEnabled.mockResolvedValueOnce([
      buildTarget({ id: 'first', name: 'first-prod' }),
      buildTarget({ id: 'second', name: 'second-prod' }),
    ]);
    runner.runToCompletion
      .mockRejectedValueOnce(new Error('삭제된 대상'))
      .mockResolvedValueOnce({ status: 'success' });

    await expect(service.runDueTargets(now)).resolves.toBe(1);

    expect(runner.runToCompletion).toHaveBeenCalledTimes(2);
  });

  it('여러 대상을 동시에 돌리지 않고 하나씩 백업한다', async () => {
    targetRepository.findEnabled.mockResolvedValueOnce([
      buildTarget({ id: 'first', name: 'first-prod' }),
      buildTarget({ id: 'second', name: 'second-prod' }),
    ]);
    let finishFirst: (value: unknown) => void = () => undefined;
    runner.runToCompletion.mockReturnValueOnce(
      new Promise((resolve) => {
        finishFirst = resolve;
      }),
    );

    const pending = service.runDueTargets(now);
    await new Promise((resolve) => setImmediate(resolve));

    expect(runner.runToCompletion).toHaveBeenCalledTimes(1);

    finishFirst({ status: 'success' });
    await pending;

    expect(runner.runToCompletion).toHaveBeenCalledTimes(2);
  });

  it('앞선 점검이 끝나지 않았으면 다음 점검은 건너뛴다', async () => {
    let finishLookup: (value: BackupTarget[]) => void = () => undefined;
    targetRepository.findEnabled.mockReturnValueOnce(
      new Promise((resolve) => {
        finishLookup = resolve;
      }),
    );

    const first = service.handleTick();
    await service.handleTick();

    expect(targetRepository.findEnabled).toHaveBeenCalledTimes(1);

    finishLookup([]);
    await first;

    targetRepository.findEnabled.mockResolvedValueOnce([]);
    await service.handleTick();
    expect(targetRepository.findEnabled).toHaveBeenCalledTimes(2);
  });

  it('점검 중 예외가 나도 밖으로 내보내지 않는다', async () => {
    targetRepository.findEnabled.mockRejectedValueOnce(
      new Error('DB 연결 끊김'),
    );

    await expect(service.handleTick()).resolves.toBeUndefined();
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.stringContaining('DB 연결 끊김'),
    );
  });
});
