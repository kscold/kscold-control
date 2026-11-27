import type { Mock } from 'vitest';
import { ShellOsMetricsRepository } from '@/system/infrastructure/repositories/shell-os-metrics.repository';

describe('ShellOsMetricsRepository', () => {
  it('디스크 수집 실패 시 마지막 성공값을 stale 상태로 반환한다', async () => {
    const repository = new ShellOsMetricsRepository();
    const now = Date.now();

    (repository as any).diskCache = {
      timestamp: now - 181_000,
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
            lastCollectedAt: now - 181_000,
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
      vi.spyOn(
        repository as never,
        'getDockerStorageUsage' as never,
      ) as unknown as Mock
    ).mockRejectedValue(new Error('docker unavailable'));

    const result = await repository.getDiskInfo();

    expect(result.used).toBe(70);
    expect(result.breakdown.dockerUsage.collectionState).toBe('stale');
    expect(result.breakdown.dockerUsage.warning).toBe(
      '최근 수집값을 유지하고 있습니다.',
    );
  });
  it('지난 값이 있으면 기다리지 않고 바로 주고, 다시 재기는 한 번만 한다', async () => {
    const repository = new ShellOsMetricsRepository();
    const cached = {
      timestamp: Date.now() - 61_000,
      data: {
        diskInfo: { total: 100, used: 30, available: 70, usedPercent: 30 },
        diskBreakdown: {
          docker: 0,
          applications: 0,
          other: 30,
          dockerUsage: {},
        },
      },
    };
    (repository as any).diskCache = cached;
    // 다시 재는 작업이 끝나지 않아도 응답이 나와야 한다.
    const collect = (
      vi.spyOn(
        repository as never,
        'collectDiskInfo' as never,
      ) as unknown as Mock
    ).mockReturnValue(new Promise(() => {}));

    const first = await repository.getDiskInfo();
    await repository.getDiskInfo();

    expect(first.used).toBe(30);
    expect(collect).toHaveBeenCalledTimes(1);
  });
});
