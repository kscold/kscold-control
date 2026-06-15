import { OsMetricsRepositoryImpl } from '../os-metrics.repository.impl';

describe('OsMetricsRepositoryImpl', () => {
  it('디스크 수집 실패 시 마지막 성공값을 stale 상태로 반환한다', async () => {
    const repository = new OsMetricsRepositoryImpl();
    const now = Date.now();

    (repository as any).diskCache = {
      timestamp: now - 61_000,
      data: {
        diskInfo: {
          total: 100,
          used: 70,
          available: 30,
          usedPercent: 70,
        },
        diskBreakdown: {
          docker: 20,
          applications: 10,
          other: 40,
          dockerUsage: {
            total: 15,
            reclaimable: 5,
            storageLabel: 'Colima VM',
            storagePath: '/Users/test/.colima',
            storagePathSize: 20,
            lastCollectedAt: now - 61_000,
            collectionState: 'fresh',
            warning: null,
            images: { size: 1, reclaimable: 1, active: 1, totalCount: 1 },
            containers: { size: 1, reclaimable: 0, active: 1, totalCount: 1 },
            volumes: { size: 1, reclaimable: 0, active: 1, totalCount: 1 },
            buildCache: { size: 1, reclaimable: 0, active: 1, totalCount: 1 },
          },
        },
      },
    };

    (
      jest.spyOn(
        repository as never,
        'getDockerStorageUsage' as never,
      ) as unknown as jest.Mock
    ).mockRejectedValue(new Error('docker unavailable'));

    const result = await repository.getDiskInfo();

    expect(result.used).toBe(70);
    expect(result.breakdown.dockerUsage.collectionState).toBe('stale');
    expect(result.breakdown.dockerUsage.warning).toBe(
      '최근 수집값을 유지하고 있습니다.',
    );
  });
});
