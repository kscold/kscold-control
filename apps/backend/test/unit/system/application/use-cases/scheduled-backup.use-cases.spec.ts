import { GetScheduledBackupsUseCase } from '@/system/application/use-cases/get-scheduled-backups.use-case';
import { RunScheduledBackupUseCase } from '@/system/application/use-cases/run-scheduled-backup.use-case';

describe('예약 백업 use case', () => {
  const scheduledBackupService = {
    listTargets: jest.fn(),
    isRunning: jest.fn(),
    runTarget: jest.fn(),
  };
  const runRepository = { findLatest: jest.fn(), save: jest.fn() };
  const mongodbBackupRepository = { create: jest.fn(), list: jest.fn() };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('즉시 실행은 수동 실행으로 서비스에 위임한다', async () => {
    const run = { target: 'app-prod', success: true };
    scheduledBackupService.runTarget.mockResolvedValueOnce(run);
    const useCase = new RunScheduledBackupUseCase(
      scheduledBackupService as any,
    );

    await expect(useCase.execute('app-prod')).resolves.toEqual(run);
    expect(scheduledBackupService.runTarget).toHaveBeenCalledWith(
      'app-prod',
      'manual',
    );
  });

  it('현황에 일정·최근 결과·보관 중인 백업을 담되 접속 URI 는 싣지 않는다', async () => {
    const lastRun = { target: 'app-prod', success: true };
    const backups = [
      { date: '2026-10-06_18-30-00', path: '/backups/x', size: '1.2M' },
    ];
    scheduledBackupService.listTargets.mockReturnValue([
      {
        name: 'app-prod',
        uri: 'mongodb+srv://backup:secret-pass@cluster.example.net/prod',
        retentionDays: 10,
        image: 'mongo:7',
      },
    ]);
    scheduledBackupService.isRunning.mockReturnValue(false);
    runRepository.findLatest.mockReturnValue(lastRun);
    mongodbBackupRepository.list.mockResolvedValue(backups);
    const useCase = new GetScheduledBackupsUseCase(
      scheduledBackupService as any,
      runRepository,
      mongodbBackupRepository,
    );

    const overview = await useCase.execute();

    expect(overview).toEqual({
      schedule: { cron: '30 3 * * *', timeZone: 'Asia/Seoul' },
      targets: [
        {
          name: 'app-prod',
          retentionDays: 10,
          running: false,
          lastRun,
          backups,
        },
      ],
    });
    expect(JSON.stringify(overview)).not.toContain('secret-pass');
    expect(runRepository.findLatest).toHaveBeenCalledWith('app-prod');
    expect(mongodbBackupRepository.list).toHaveBeenCalledWith('app-prod');
  });

  it('등록된 대상이 없으면 빈 목록을 돌려준다', async () => {
    scheduledBackupService.listTargets.mockReturnValue([]);
    const useCase = new GetScheduledBackupsUseCase(
      scheduledBackupService as any,
      runRepository,
      mongodbBackupRepository,
    );

    await expect(useCase.execute()).resolves.toMatchObject({ targets: [] });
  });
});
