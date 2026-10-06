import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { ScheduledBackupService } from '@/system/application/services/scheduled-backup.service';
import type { ScheduledBackupTarget } from '@/system/domain/types/scheduled-backup.type';

describe('ScheduledBackupService', () => {
  const appTarget: ScheduledBackupTarget = {
    name: 'app-prod',
    uri: 'mongodb+srv://backup:secret-pass@cluster.example.net/prod',
    retentionDays: 10,
    image: 'mongo:7',
  };
  const otherTarget: ScheduledBackupTarget = {
    name: 'other-prod',
    uri: 'mongodb://backup:secret-pass@db.example.net:27017/main',
    retentionDays: 3,
    image: 'mongo:7',
  };

  const targetRepository = { findAll: jest.fn() };
  const backupRepository = { create: jest.fn(), prune: jest.fn() };
  const runRepository = { findLatest: jest.fn(), save: jest.fn() };
  let service: ScheduledBackupService;

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    // 실패 경로 테스트가 남기는 로그로 테스트 출력이 지저분해지지 않게 한다.
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    targetRepository.findAll.mockReturnValue([appTarget, otherTarget]);
    backupRepository.prune.mockResolvedValue([]);
    service = new ScheduledBackupService(
      targetRepository,
      backupRepository,
      runRepository,
    );
  });

  it('매일 03:30(KST)에 실행되도록 등록한다', () => {
    expect(
      Reflect.getMetadata(
        'SCHEDULE_CRON_OPTIONS',
        ScheduledBackupService.prototype.handleSchedule,
      ),
    ).toMatchObject({ cronTime: '30 3 * * *', timeZone: 'Asia/Seoul' });
  });

  it('기동할 때 등록된 대상과 보관 기간을 로그로 남긴다', () => {
    service.onModuleInit();

    expect(Logger.prototype.log).toHaveBeenCalledWith(
      expect.stringContaining('app-prod(보관 10일), other-prod(보관 3일)'),
    );
    // 접속 URI 는 로그에 남기지 않는다.
    expect(Logger.prototype.log).not.toHaveBeenCalledWith(
      expect.stringContaining('secret-pass'),
    );
  });

  it('등록된 대상이 없으면 기동 로그를 남기지 않는다', () => {
    targetRepository.findAll.mockReturnValue([]);

    service.onModuleInit();

    expect(Logger.prototype.log).not.toHaveBeenCalled();
  });

  it('백업이 성공하면 보관 기간이 지난 백업을 정리하고 결과를 기록한다', async () => {
    backupRepository.create.mockResolvedValueOnce({
      path: '/backups/app-prod/2026-10-06_18-30-00',
      size: '1.2M',
    });
    backupRepository.prune.mockResolvedValueOnce(['2026-09-20_18-30-00']);

    const run = await service.runTarget('app-prod', 'manual');

    expect(backupRepository.create).toHaveBeenCalledWith(appTarget);
    expect(backupRepository.prune).toHaveBeenCalledWith('app-prod', 10);
    expect(run).toMatchObject({
      target: 'app-prod',
      trigger: 'manual',
      success: true,
      path: '/backups/app-prod/2026-10-06_18-30-00',
      size: '1.2M',
      pruned: ['2026-09-20_18-30-00'],
    });
    expect(runRepository.save).toHaveBeenCalledWith(run);
  });

  it('백업이 실패하면 옛 백업을 정리하지 않는다', async () => {
    backupRepository.create.mockRejectedValueOnce(new Error('인증 실패'));

    const run = await service.runTarget('app-prod', 'manual');

    expect(backupRepository.prune).not.toHaveBeenCalled();
    expect(run).toMatchObject({
      success: false,
      message: '백업 실패: 인증 실패',
      path: null,
      size: null,
      pruned: [],
    });
    expect(runRepository.save).toHaveBeenCalledWith(run);
  });

  it('한 대상이 실패해도 다음 대상은 계속 백업한다', async () => {
    backupRepository.create
      .mockRejectedValueOnce(new Error('연결 실패'))
      .mockResolvedValueOnce({ path: '/backups/other-prod/x', size: '3M' });

    const runs = await service.runAll('schedule');

    expect(runs.map((run) => [run.target, run.success])).toEqual([
      ['app-prod', false],
      ['other-prod', true],
    ]);
    expect(backupRepository.prune).toHaveBeenCalledTimes(1);
    expect(backupRepository.prune).toHaveBeenCalledWith('other-prod', 3);
  });

  it('정리에 실패해도 방금 만든 백업은 성공으로 남긴다', async () => {
    backupRepository.create.mockResolvedValueOnce({ path: '/b', size: '1M' });
    backupRepository.prune.mockRejectedValueOnce(new Error('권한 없음'));

    const run = await service.runTarget('app-prod', 'manual');

    expect(run.success).toBe(true);
    expect(run.path).toBe('/b');
    expect(run.message).toContain('정리에 실패');
  });

  it('결과 기록에 실패해도 실행 결과를 돌려준다', async () => {
    backupRepository.create.mockResolvedValueOnce({ path: '/b', size: '1M' });
    runRepository.save.mockImplementationOnce(() => {
      throw new Error('디스크 가득 참');
    });

    await expect(
      service.runTarget('app-prod', 'manual'),
    ).resolves.toMatchObject({ success: true });
  });

  it('등록되지 않은 대상은 거부한다', async () => {
    await expect(service.runTarget('unknown', 'manual')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(backupRepository.create).not.toHaveBeenCalled();
  });

  it('진행 중인 대상을 다시 실행하면 거부하고, 끝난 뒤에는 다시 받는다', async () => {
    let finishFirst: (value: { path: string; size: string }) => void = () =>
      undefined;
    backupRepository.create.mockReturnValueOnce(
      new Promise((resolve) => {
        finishFirst = resolve;
      }),
    );

    const first = service.runTarget('app-prod', 'manual');

    expect(service.isRunning('app-prod')).toBe(true);
    await expect(
      service.runTarget('app-prod', 'manual'),
    ).rejects.toBeInstanceOf(ConflictException);

    finishFirst({ path: '/b', size: '1M' });
    await first;

    expect(service.isRunning('app-prod')).toBe(false);
    backupRepository.create.mockResolvedValueOnce({ path: '/c', size: '1M' });
    await expect(
      service.runTarget('app-prod', 'manual'),
    ).resolves.toMatchObject({ success: true, path: '/c' });
  });

  it('전체 실행은 진행 중인 대상을 건너뛴다', async () => {
    let finishFirst: (value: { path: string; size: string }) => void = () =>
      undefined;
    backupRepository.create
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishFirst = resolve;
        }),
      )
      .mockResolvedValueOnce({ path: '/backups/other-prod/x', size: '3M' });

    const manual = service.runTarget('app-prod', 'manual');
    const runs = await service.runAll('schedule');

    expect(runs.map((run) => run.target)).toEqual(['other-prod']);

    finishFirst({ path: '/b', size: '1M' });
    await manual;
  });

  it('스케줄 실행은 예외를 밖으로 내보내지 않는다', async () => {
    targetRepository.findAll.mockImplementationOnce(() => {
      throw new Error('설정 읽기 실패');
    });

    await expect(service.handleSchedule()).resolves.toBeUndefined();
  });

  it('등록된 대상이 없으면 아무것도 실행하지 않는다', async () => {
    targetRepository.findAll.mockReturnValue([]);

    await expect(service.runAll('schedule')).resolves.toEqual([]);
    expect(backupRepository.create).not.toHaveBeenCalled();
    expect(runRepository.save).not.toHaveBeenCalled();
  });
});
