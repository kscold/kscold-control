import { SystemController } from './system.controller';

describe('SystemController', () => {
  const getStatsUseCase = { execute: jest.fn() };
  const getSystemInfoUseCase = { execute: jest.fn() };
  const backupMongodbUseCase = { execute: jest.fn() };
  const listBackupsUseCase = { execute: jest.fn() };

  const controller = new SystemController(
    getStatsUseCase as any,
    getSystemInfoUseCase as any,
    backupMongodbUseCase as any,
    listBackupsUseCase as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('라이브 통계를 그대로 반환한다', async () => {
    const stats = {
      cpu: { usage: 12.3, count: 10, model: 'M4' },
      memory: { used: 1, total: 2, usedPercent: 50 },
      uptime: 1234,
    };
    getStatsUseCase.execute.mockResolvedValueOnce(stats);

    await expect(controller.getStats()).resolves.toEqual(stats);
  });

  it('시스템 정보를 그대로 반환한다', async () => {
    const systemInfo = {
      cpu: { count: 10, model: 'M4' },
      memory: { used: 1, total: 2, usedPercent: 50 },
      disk: { total: 3, used: 1, usedPercent: 33, breakdown: {} },
      platform: 'darwin',
      hostname: 'mac-mini',
      uptime: 10,
    };
    getSystemInfoUseCase.execute.mockResolvedValueOnce(systemInfo);

    await expect(controller.getSystemInfo()).resolves.toEqual(systemInfo);
  });

  it('MongoDB 백업 응답에 success=true를 붙인다', async () => {
    const backupResult = {
      backupPath: '/tmp/backup.gz',
      fileName: 'backup.gz',
      size: 1000,
    };
    backupMongodbUseCase.execute.mockResolvedValueOnce(backupResult);

    await expect(controller.backupMongodb('mongo-1')).resolves.toEqual({
      success: true,
      ...backupResult,
    });
    expect(backupMongodbUseCase.execute).toHaveBeenCalledWith('mongo-1');
  });

  it('백업 목록 조회는 컨테이너 이름을 그대로 전달한다', () => {
    const backups = [{ fileName: 'backup.gz', size: 1000 }];
    listBackupsUseCase.execute.mockReturnValueOnce(backups);

    expect(controller.listBackups('mongo-1')).toEqual(backups);
    expect(listBackupsUseCase.execute).toHaveBeenCalledWith('mongo-1');
  });
});
